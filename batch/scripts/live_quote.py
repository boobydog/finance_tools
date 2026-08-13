"""銘柄詳細画面向けのほぼリアルタイム株価取得。

yfinanceのfast_infoは軽量なため、日次キャッシュ(daily_stock_data)とは別に
画面が開かれている間だけオンデマンドで叩く用途に向く。DBには保存しない
(常に最新値を都度取得する使い捨てのデータのため)。

東証の取引時間外は株価が動かないため、yfinanceは呼ばず日次キャッシュから
返す(scripts.market_hours.is_tse_open で判定し、呼び出し側で分岐する)。
"""

import logging

import yfinance as yf
from sqlalchemy import bindparam, text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

MAX_BULK_SYMBOLS = 50


def _fast_info_get(fast_info, key: str):
    # yfinanceのFastInfo.get()は常にNoneを返す既知の実装のため、
    # 添字アクセス(KeyError発生時のみNone扱い)を使う。
    try:
        return fast_info[key]
    except Exception:
        return None


def fetch_live_quote(symbol: str) -> dict | None:
    """始値・現在値・前日終値等を取得する。取得できない場合はNoneを返す。"""
    try:
        fast_info = yf.Ticker(symbol).fast_info
        return {
            "open": _fast_info_get(fast_info, "open"),
            "current_price": _fast_info_get(fast_info, "last_price"),
            "previous_close": _fast_info_get(fast_info, "previous_close"),
            "day_high": _fast_info_get(fast_info, "day_high"),
            "day_low": _fast_info_get(fast_info, "day_low"),
        }
    except Exception:
        logger.warning("Failed to fetch live quote for %s", symbol, exc_info=True)
        return None


def fetch_live_quotes(symbols: list[str]) -> dict[str, dict | None]:
    """複数銘柄の株価をまとめて取得する(画面表示中の銘柄のみ等、少数向け)。

    負荷が読めない一括アクセスを避けるため、件数はMAX_BULK_SYMBOLSで強制的に絞る。
    """
    limited = symbols[:MAX_BULK_SYMBOLS]
    return {symbol: fetch_live_quote(symbol) for symbol in limited}


def fetch_cached_quote(engine: Engine, symbol: str) -> dict | None:
    """取引時間外用: 日次キャッシュ(daily_stock_data)から始値・終値・前日終値等を返す。"""
    with engine.connect() as conn:
        row = conn.execute(
            text(load_sql("select_cached_quote.sql")), {"ticker_symbol": symbol}
        ).mappings().first()
    if row is None or row["latest_close"] is None:
        return None
    return {
        "open": float(row["open_price"]) if row["open_price"] is not None else None,
        "current_price": float(row["latest_close"]),
        "previous_close": float(row["previous_close"]) if row["previous_close"] is not None else None,
        "day_high": float(row["day_high"]) if row["day_high"] is not None else None,
        "day_low": float(row["day_low"]) if row["day_low"] is not None else None,
    }


def fetch_cached_quotes(engine: Engine, symbols: list[str]) -> dict[str, dict | None]:
    """取引時間外用(複数銘柄): 日次キャッシュからまとめて返す。"""
    limited = symbols[:MAX_BULK_SYMBOLS]
    if not limited:
        return {}
    stmt = text(load_sql("select_cached_quotes_bulk.sql")).bindparams(
        bindparam("ticker_symbols", expanding=True)
    )
    with engine.connect() as conn:
        rows = conn.execute(stmt, {"ticker_symbols": limited}).mappings().all()
    quotes = {
        row["ticker_symbol"]: {
            "open": float(row["open_price"]) if row["open_price"] is not None else None,
            "current_price": float(row["latest_close"]) if row["latest_close"] is not None else None,
            "previous_close": float(row["previous_close"]) if row["previous_close"] is not None else None,
            "day_high": float(row["day_high"]) if row["day_high"] is not None else None,
            "day_low": float(row["day_low"]) if row["day_low"] is not None else None,
        }
        for row in rows
    }
    return {symbol: quotes.get(symbol) for symbol in limited}
