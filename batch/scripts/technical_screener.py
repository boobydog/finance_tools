"""テクニカル指標によるスコアリングスクリーニング。

有名投資家の手法を参考にした5要素のスコアリングでJSON指定の候補銘柄を採点する。

1. ワインスタイン ステージ2判定 (+30点)
   終値 > SMA50 > SMA200 かつ SMA200が直近20日間で上昇していれば加点。
2. 相対強度(RS)ランキング (+25点)
   RS = (1 + 個別株の6ヶ月リターン) ÷ (1 + ベンチマーク(日経225)の6ヶ月リターン)。
   RS >= 閾値(既定1.3)で加点。
   単純な「リターン÷リターン」ではなく(1+リターン)同士の比にしているのは、
   ベンチマークが下落局面(リターン<=0)でも符号が反転せず、直感通りに
   「市場より強いかどうか」を判定できるようにするため。
3. 出来高急増 (+20点)
   直近出来高が20日平均の1.5倍以上で加点。
4. RSI適温ゾーン (+15点 / 過熱ペナルティ-10点)
   RSIが45〜65なら加点、70超は減点。
5. VCPまたは52週高値圏 (+10点)
   終値が52週高値の95%以上、または直近のボラティリティ(ATR/終値)が
   1つ前の期間より収縮していれば加点。

   TODO: 本来のVCP(Volatility Contraction Pattern、ミネルヴィニ)は、
   複数回の押し目(スイング)が徐々に浅く・出来高も減りながら収縮していく
   パターンを検出するものだが、ここではその厳密な検出は行わず、
   ATR/終値の単純な期間比較による簡易的な近似で代用している。
   複数スイングの収縮を検出する本格的な実装は今後の課題とする。
"""

import logging
import re
from datetime import date, timedelta

import numpy as np
import pandas as pd
import talib
import yfinance as yf
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from scripts.nikkei225 import fetch_constituent_symbols
from scripts.sql_runner import load_sql
from scripts.yfinance_batch import chunked

logger = logging.getLogger(__name__)

REQUIRED_HISTORY_DAYS = 252  # 52週(1年)分の取引日数の目安
DEFAULT_CANDIDATE_SCORE_THRESHOLD = 60

_PERIOD_PATTERN = re.compile(r"^(\d+)(d|mo|y)$")
_PERIOD_UNIT_DAYS = {"d": 1, "mo": 30, "y": 365}


def _period_to_timedelta(period: str) -> timedelta:
    match = _PERIOD_PATTERN.match(period)
    if not match:
        raise ValueError(f"Unsupported period: {period}")
    value, unit = match.groups()
    return timedelta(days=int(value) * _PERIOD_UNIT_DAYS[unit])


def _store_history(engine: Engine, symbol: str, df: pd.DataFrame) -> bool:
    """dfをdaily_stock_dataへupsertする。

    daily_stock_data.ticker_symbolはstocksへの外部キーのため、ベンチマーク指数
    (^N225等)のようにstocksに存在しない銘柄は保存できない。その場合はFalseを返し、
    呼び出し側でキャッシュを使わずyfinanceの結果をそのまま使うようフォールバックする。
    """
    rows = [
        {
            "ticker_symbol": symbol,
            "date": index.date(),
            "open_price": float(row["Open"]),
            "close_price": float(row["Close"]),
            "high_price": float(row["High"]),
            "low_price": float(row["Low"]),
            "volume": int(row["Volume"]),
        }
        for index, row in df.iterrows()
    ]
    if not rows:
        return True
    try:
        with engine.begin() as conn:
            conn.execute(text(load_sql("upsert_daily_stock_data.sql")), rows)
        return True
    except IntegrityError:
        logger.info("%s is not a tracked stock, skip caching its history", symbol)
        return False


def _yfinance_df_to_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    return df[["Open", "Close", "High", "Low", "Volume"]].astype(float)


def _load_history(engine: Engine, symbol: str, start_date: date) -> pd.DataFrame | None:
    with engine.connect() as conn:
        rows = conn.execute(
            text(load_sql("select_daily_stock_data_since.sql")),
            {"ticker_symbol": symbol, "start_date": start_date},
        ).mappings().all()
    if not rows:
        return None

    df = pd.DataFrame(rows).set_index("date")
    df.index = pd.to_datetime(df.index)
    df = df.rename(
        columns={
            "open_price": "Open",
            "close_price": "Close",
            "high_price": "High",
            "low_price": "Low",
            "volume": "Volume",
        }
    )
    return df[["Open", "Close", "High", "Low", "Volume"]].astype(float)


def _fetch_history(engine: Engine, symbol: str, period: str) -> pd.DataFrame | None:
    """symbolのOHLCV履歴を返す。daily_stock_dataをローカルキャッシュとして使い、
    2回目以降は前回保存日の翌日以降(差分)のみyfinanceから取得する。

    キャッシュ済みの最古日がperiodの開始日より新しい場合(=より長い期間を要求された
    場合)は、深さが足りないため期間全体を取り直す。それ以外は最新日の翌日以降の
    差分のみ取得する。
    """
    today = date.today()
    start_date = today - _period_to_timedelta(period)

    with engine.connect() as conn:
        row = conn.execute(
            text(load_sql("select_daily_stock_data_date_range.sql")), {"ticker_symbol": symbol}
        ).mappings().first()
    cached_min_date = row["min_date"] if row else None
    cached_max_date = row["max_date"] if row else None

    if cached_min_date is None or cached_min_date > start_date:
        df = yf.Ticker(symbol).history(period=period)
        if df.empty:
            logger.warning("No historical data returned for %s", symbol)
            return None
        if not _store_history(engine, symbol, df):
            return _yfinance_df_to_ohlcv(df)
    elif cached_max_date < today:
        fetch_start = cached_max_date + timedelta(days=1)
        delta_df = yf.Ticker(symbol).history(start=fetch_start.isoformat())
        if not delta_df.empty:
            _store_history(engine, symbol, delta_df)

    result = _load_history(engine, symbol, start_date)
    if result is None:
        logger.warning("No historical data available for %s", symbol)
    return result


def _score_stage2(df: pd.DataFrame, cfg: dict) -> tuple[int, dict]:
    short_period = cfg["sma_short_period"]
    long_period = cfg["sma_long_period"]
    lookback = cfg["sma_long_trend_lookback_days"]

    close = df["Close"].values
    if len(close) < long_period + lookback:
        return 0, {"stage2": False}

    sma_short = talib.SMA(close, timeperiod=short_period)
    sma_long = talib.SMA(close, timeperiod=long_period)

    is_stage2 = bool(
        close[-1] > sma_short[-1] > sma_long[-1]
        and sma_long[-1] > sma_long[-1 - lookback]
    )
    return (cfg["points"] if is_stage2 else 0), {"stage2": is_stage2}


def _score_relative_strength(
    df: pd.DataFrame, benchmark_df: pd.DataFrame, cfg: dict
) -> tuple[int, dict]:
    lookback = cfg["lookback_days"]
    close = df["Close"].values
    benchmark_close = benchmark_df["Close"].values
    if len(close) <= lookback or len(benchmark_close) <= lookback:
        return 0, {"rs": None}

    stock_return = close[-1] / close[-1 - lookback] - 1
    benchmark_return = benchmark_close[-1] / benchmark_close[-1 - lookback] - 1
    denominator = 1 + benchmark_return
    if denominator == 0:
        return 0, {"rs": None}

    rs = (1 + stock_return) / denominator
    meets_threshold = rs >= cfg["threshold"]
    return (cfg["points"] if meets_threshold else 0), {"rs": rs}


def _score_volume_surge(df: pd.DataFrame, cfg: dict) -> tuple[int, dict]:
    period = cfg["average_period"]
    volume = df["Volume"].values
    if len(volume) < period + 1:
        return 0, {"volume_ratio": None}

    average_volume = volume[-period - 1 : -1].mean()
    if average_volume == 0:
        return 0, {"volume_ratio": None}

    ratio = volume[-1] / average_volume
    meets_threshold = ratio >= cfg["ratio_threshold"]
    return (cfg["points"] if meets_threshold else 0), {"volume_ratio": ratio}


def _score_rsi_zone(df: pd.DataFrame, cfg: dict) -> tuple[int, dict]:
    close = df["Close"].values
    rsi = talib.RSI(close, timeperiod=cfg["period"])
    if len(rsi) == 0 or np.isnan(rsi[-1]):
        return 0, {"rsi": None}

    latest_rsi = rsi[-1]
    if latest_rsi > cfg["overbought_threshold"]:
        return cfg["overbought_penalty"], {"rsi": latest_rsi}
    if cfg["comfort_low"] <= latest_rsi <= cfg["comfort_high"]:
        return cfg["points"], {"rsi": latest_rsi}
    return 0, {"rsi": latest_rsi}


def _is_volatility_contracting(df: pd.DataFrame, lookback_days: int) -> bool:
    """VCPの簡易近似(TODO: 複数スイングを検出する本格的なVCP判定に置き換える)。"""
    atr = talib.ATR(df["High"].values, df["Low"].values, df["Close"].values, timeperiod=14)
    normalized = atr / df["Close"].values
    if len(normalized) < lookback_days * 2:
        return False
    window = normalized[-lookback_days * 2 :]
    if np.isnan(window).any():
        return False
    recent = window[-lookback_days:].mean()
    prior = window[:lookback_days].mean()
    return bool(recent < prior)


def _score_vcp_or_high(df: pd.DataFrame, cfg: dict) -> tuple[int, dict]:
    close = df["Close"].values
    high_52w = df["High"].values[-REQUIRED_HISTORY_DAYS:].max()
    near_high = bool(close[-1] >= high_52w * cfg["high_52w_ratio_threshold"])
    contracting = _is_volatility_contracting(df, cfg["volatility_lookback_days"])
    meets = near_high or contracting
    return (cfg["points"] if meets else 0), {
        "high_52w": high_52w,
        "near_52w_high": near_high,
        "volatility_contracting": contracting,
    }


def _score_symbol(symbol: str, df: pd.DataFrame, benchmark_df: pd.DataFrame, scoring_cfg: dict) -> dict:
    stage2_score, stage2_detail = _score_stage2(df, scoring_cfg["stage2"])
    rs_score, rs_detail = _score_relative_strength(df, benchmark_df, scoring_cfg["relative_strength"])
    volume_score, volume_detail = _score_volume_surge(df, scoring_cfg["volume_surge"])
    rsi_score, rsi_detail = _score_rsi_zone(df, scoring_cfg["rsi_zone"])
    vcp_score, vcp_detail = _score_vcp_or_high(df, scoring_cfg["vcp_or_high"])

    total_score = stage2_score + rs_score + volume_score + rsi_score + vcp_score

    record = {
        "symbol": symbol,
        "close": df["Close"].values[-1],
        "total_score": total_score,
        "stage2_score": stage2_score,
        "rs_score": rs_score,
        "volume_score": volume_score,
        "rsi_score": rsi_score,
        "vcp_score": vcp_score,
    }
    record.update(stage2_detail)
    record.update(rs_detail)
    record.update(volume_detail)
    record.update(rsi_detail)
    record.update(vcp_detail)
    return record


def run_technical_screen(engine: Engine, config: dict) -> list[dict]:
    """JSON設定の候補銘柄をテクニカル指標でスコアリングし、高得点順に返す。

    候補銘柄は config["symbols"] に加え、config["include_nikkei225"] が
    真の場合は日経225の構成銘柄(225銘柄)も候補に追加される(重複は除外)。
    """
    symbols = set(config.get("symbols", []))
    if config.get("include_nikkei225"):
        symbols |= set(fetch_constituent_symbols())
    symbols = sorted(symbols)

    benchmark_symbol = config["benchmark_symbol"]
    period = config.get("history_period", "2y")
    scoring_cfg = config["scoring"]

    benchmark_df = _fetch_history(engine, benchmark_symbol, period)
    if benchmark_df is None:
        raise RuntimeError(f"Failed to fetch benchmark history for {benchmark_symbol}")

    records: list[dict] = []
    for batch in chunked(symbols):
        for symbol in batch:
            df = _fetch_history(engine, symbol, period)
            if df is None:
                continue
            records.append(_score_symbol(symbol, df, benchmark_df, scoring_cfg))

    return sorted(records, key=lambda r: r["total_score"], reverse=True)


def persist_scores(engine: Engine, records: list[dict]) -> None:
    """スコアリング結果をtechnical_scoresへ保存する。"""
    if not records:
        return
    rows = [
        {
            "ticker_symbol": r["symbol"],
            "total_score": r["total_score"],
            "stage2_score": r["stage2_score"],
            "rs_score": r["rs_score"],
            "volume_score": r["volume_score"],
            "rsi_score": r["rsi_score"],
            "vcp_score": r["vcp_score"],
        }
        for r in records
    ]
    with engine.begin() as conn:
        conn.execute(text(load_sql("upsert_technical_score.sql")), rows)
    logger.info("Persisted technical scores for %d symbols", len(rows))


SCORE_TAG_TIERS = (100, 80, 60, 40, 20)
SCORE_TAG_COLOR = "#00c853"


def _score_tag_name(score: float) -> str | None:
    """スコアが到達している最高階層(20/40/60/80/100点以上)のタグ名を返す。"""
    for tier in SCORE_TAG_TIERS:
        if score >= tier:
            return f"高スコア({tier}点以上)"
    return None


def sync_score_tags(engine: Engine, records: list[dict]) -> None:
    """各銘柄に、実際のスコアに応じた階層タグを同期する。

    「候補(interested)」への自動反映(apply_score_candidates)とは独立しており、
    候補化されていない銘柄でもスコアが20点以上あればタグが付く(表示・フィルタ用)。
    """
    with engine.begin() as conn:
        for record in records:
            ticker_symbol = record["symbol"]
            tag_name = _score_tag_name(record["total_score"])
            conn.execute(
                text(load_sql("delete_stock_score_tags_except.sql")),
                {"ticker_symbol": ticker_symbol, "current_tag_name": tag_name or ""},
            )
            if tag_name is None:
                continue
            tag_row = conn.execute(text(load_sql("select_tag_by_name.sql")), {"name": tag_name}).mappings().first()
            tag_id = tag_row["tag_id"] if tag_row else conn.execute(
                text(load_sql("insert_tag.sql")), {"name": tag_name, "color": SCORE_TAG_COLOR}
            ).lastrowid
            conn.execute(
                text(load_sql("insert_stock_tag.sql")), {"ticker_symbol": ticker_symbol, "tag_id": tag_id}
            )


def reconcile_stale_score_candidates(engine: Engine, threshold: int) -> int:
    """しきい値変更等で、現在のスコアがしきい値未満になった「候補」銘柄をリセットする
    (screening_engineのreconcile_inactive_group_candidatesと同じ考え方)。
    有効なスクリーニンググループのタグを別途持つ銘柄には触れない。タグ自体は
    (候補化とは独立した情報のため)リセットしても消さない。
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text(load_sql("select_stale_score_candidates.sql")), {"threshold": threshold}
        ).mappings().all()
    ticker_symbols = [row["ticker_symbol"] for row in rows]

    if ticker_symbols:
        with engine.begin() as conn:
            for ticker_symbol in ticker_symbols:
                conn.execute(
                    text(load_sql("delete_user_stock_status_by_ticker.sql")), {"ticker_symbol": ticker_symbol}
                )
        logger.info("reconcile_stale_score_candidates: reset %d stocks", len(ticker_symbols))
    return len(ticker_symbols)


def apply_score_candidates(engine: Engine, threshold: int = DEFAULT_CANDIDATE_SCORE_THRESHOLD) -> int:
    """スコアがthreshold以上、かつステータス未設定の銘柄を「候補」として反映する。

    screening_engine(A/B/Cルール判定)と同様、既に手動でステータスが
    設定されている銘柄は上書きしない。タグはsync_score_tagsが別途、各銘柄の
    実際のスコア階層に応じて付与するため、ここでは触れない。
    """
    reconcile_stale_score_candidates(engine, threshold)

    with engine.connect() as conn:
        rows = conn.execute(
            text(load_sql("select_untouched_high_scores.sql")), {"threshold": threshold}
        ).mappings().all()

    if not rows:
        return 0

    with engine.begin() as conn:
        for row in rows:
            conn.execute(
                text(load_sql("upsert_user_stock_status.sql")),
                {"ticker_symbol": row["ticker_symbol"], "status": "interested"},
            )

    logger.info("Applied candidate status to %d high-scoring stocks (threshold=%d)", len(rows), threshold)
    return len(rows)
