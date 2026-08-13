"""screening_param_definitionsの数値項目(基礎指標+技術指標)をyfinanceから取得し、
stock_metricsへ保存する。screening_engineが銘柄を評価する際のデータ源となる。

基礎指標(fundamentals)と技術指標(technical)は更新頻度が大きく異なるため、
別々に取得・保存できるよう分離している。
- 基礎指標: yfinanceのTicker.info/balance_sheet/income_stmtから取得。決算でしか
  変わらないため、cronで1日1回程度(+決算発表日とその翌日の個別更新)で十分。
  次回決算発表予定日(next_earnings_date)もあわせて取得し、その個別更新の判定に使う。
- 技術指標(相対強度・RSI・出来高倍率): technical_screener.pyと同じ計算ロジックを
  再利用し、価格履歴キャッシュ(daily_stock_data)を使うため高速。画面操作のたびに
  実行する自動パイプラインからはこちらのみを呼び出す。
"""

import logging

import numpy as np
import pandas as pd
import talib
import yfinance as yf
from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.technical_screener import _fetch_history
from scripts.sql_runner import load_sql
from scripts.yfinance_batch import chunked

logger = logging.getLogger(__name__)

BENCHMARK_SYMBOL = "^N225"
HISTORY_PERIOD = "1y"
RS_LOOKBACK_DAYS = 126
RSI_PERIOD = 14
VOLUME_AVERAGE_PERIOD = 20
MA25_PERIOD = 25
HV_LOOKBACK_DAYS = 60
TRADING_DAYS_PER_YEAR = 250


def _percent(value: float | None) -> float | None:
    return None if value is None else value * 100


def _fetch_next_earnings_date(ticker: yf.Ticker):
    """次回決算発表予定日を取得する(取得できない場合はNone)。"""
    try:
        calendar = ticker.calendar
        dates = calendar.get("Earnings Date") if calendar else None
        return dates[0] if dates else None
    except Exception:
        logger.warning("Failed to fetch earnings calendar for %s", ticker.ticker, exc_info=True)
        return None


def _fetch_earnings_surprise_percent(ticker: yf.Ticker):
    """直近発表済み決算の市場予想(コンセンサス)との乖離率(%)を取得する。

    ticker.earnings_datesは未来の予定行(Reported EPSがNaN)も含むため、
    実績が入っている最新行のSurprise(%)を採用する。
    """
    try:
        earnings_dates = ticker.earnings_dates
        if earnings_dates is None or earnings_dates.empty:
            return None
        reported = earnings_dates.dropna(subset=["Reported EPS"])
        if reported.empty:
            return None
        return float(reported.iloc[0]["Surprise(%)"])
    except Exception:
        logger.warning("Failed to fetch earnings surprise for %s", ticker.ticker, exc_info=True)
        return None


def fetch_fundamentals(symbol: str) -> dict:
    """yfinanceのinfo/balance_sheet/income_stmt/calendarから基礎指標を取得する。

    balance_sheet/income_stmt/calendarは追加のAPI呼び出しが必要なため、取得できない
    場合は該当項目をNoneのままにする(判定エンジン側でNoneのルールはスキップする)。
    """
    ticker = yf.Ticker(symbol)
    info = ticker.info

    equity_ratio = None
    try:
        bs = ticker.balance_sheet
        if bs is not None and not bs.empty:
            col = bs.columns[0]
            if "Total Assets" in bs.index and "Stockholders Equity" in bs.index:
                total_assets = bs.loc["Total Assets", col]
                equity = bs.loc["Stockholders Equity", col]
                if total_assets:
                    equity_ratio = float(equity) / float(total_assets) * 100
    except Exception:
        logger.warning("Failed to fetch balance sheet for %s", symbol, exc_info=True)

    operating_profit_yoy = None
    operating_margin = None
    try:
        income = ticker.income_stmt
        if income is not None and not income.empty and "Operating Income" in income.index:
            op_series = income.loc["Operating Income"].dropna()
            if len(op_series) >= 2:
                latest, previous = op_series.iloc[0], op_series.iloc[1]
                if previous:
                    operating_profit_yoy = (float(latest) - float(previous)) / abs(float(previous)) * 100
            if "Total Revenue" in income.index and len(op_series) >= 1:
                revenue_series = income.loc["Total Revenue"].dropna()
                if len(revenue_series) >= 1 and revenue_series.iloc[0]:
                    operating_margin = float(op_series.iloc[0]) / float(revenue_series.iloc[0]) * 100
    except Exception:
        logger.warning("Failed to fetch income statement for %s", symbol, exc_info=True)

    operating_cf = info.get("operatingCashflow")
    market_cap = info.get("marketCap")

    return {
        "ticker_symbol": symbol,
        "forward_per": info.get("forwardPE"),
        "pbr": info.get("priceToBook"),
        "bps": info.get("bookValue"),
        "target_mean_price": info.get("targetMeanPrice"),
        # 他の金額項目(operating_cf等)と同じく百万円単位で統一する
        "market_cap": round(market_cap / 1_000_000) if market_cap is not None else None,
        "dividend_yield": info.get("dividendYield"),
        "equity_ratio": equity_ratio,
        "roe": _percent(info.get("returnOnEquity")),
        "eps_growth": _percent(info.get("earningsGrowth")),
        "operating_profit_yoy": operating_profit_yoy,
        "operating_margin": operating_margin,
        "revenue_yoy": _percent(info.get("revenueGrowth")),
        "operating_cf": round(operating_cf / 1_000_000) if operating_cf is not None else None,
        "next_earnings_date": _fetch_next_earnings_date(ticker),
        "earnings_surprise_percent": _fetch_earnings_surprise_percent(ticker),
    }


def run_fundamentals_fetch(engine: Engine, symbols: list[str]) -> int:
    """symbolsの基礎指標を取得し、stock_metricsへupsertする(技術指標列は変更しない)。"""
    saved = 0
    for batch in chunked(symbols):
        rows = []
        for symbol in batch:
            try:
                rows.append(fetch_fundamentals(symbol))
            except Exception:
                logger.exception("Failed to fetch fundamentals for %s", symbol)
                continue
        if rows:
            with engine.begin() as conn:
                conn.execute(text(load_sql("upsert_stock_fundamentals.sql")), rows)
            saved += len(rows)
            logger.info("Saved fundamentals for %d/%d symbols so far", saved, len(symbols))

    return saved


def _fetch_technical_metrics(df: pd.DataFrame, benchmark_df: pd.DataFrame) -> dict:
    close = df["Close"].values
    benchmark_close = benchmark_df["Close"].values

    relative_strength = None
    if len(close) > RS_LOOKBACK_DAYS and len(benchmark_close) > RS_LOOKBACK_DAYS:
        stock_return = close[-1] / close[-1 - RS_LOOKBACK_DAYS] - 1
        benchmark_return = benchmark_close[-1] / benchmark_close[-1 - RS_LOOKBACK_DAYS] - 1
        denominator = 1 + benchmark_return
        if denominator != 0:
            relative_strength = (1 + stock_return) / denominator

    rsi_series = talib.RSI(close, timeperiod=RSI_PERIOD)
    rsi = None if len(rsi_series) == 0 or np.isnan(rsi_series[-1]) else float(rsi_series[-1])

    volume = df["Volume"].values
    volume_ratio = None
    if len(volume) >= VOLUME_AVERAGE_PERIOD + 1:
        average_volume = volume[-VOLUME_AVERAGE_PERIOD - 1 : -1].mean()
        if average_volume:
            volume_ratio = float(volume[-1] / average_volume)

    ma25_series = talib.SMA(close, timeperiod=MA25_PERIOD)
    ma25 = None if len(ma25_series) == 0 or np.isnan(ma25_series[-1]) else float(ma25_series[-1])

    # 直近から遡って、終値がMA25を連続で上回っている営業日数を数える
    # (「今日初めて上抜けたばかり」の単日スパイクと、数日かけて定着したトレンドを区別するため)。
    ma25_above_streak_days = None
    if ma25 is not None:
        streak = 0
        for i in range(len(close) - 1, -1, -1):
            m = ma25_series[i]
            if np.isnan(m) or close[i] <= m:
                break
            streak += 1
        ma25_above_streak_days = streak

    hv = None
    if len(close) > HV_LOOKBACK_DAYS:
        daily_returns = pd.Series(close[-HV_LOOKBACK_DAYS - 1 :]).pct_change().dropna()
        hv = float(daily_returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR) * 100)

    return {
        "relative_strength": relative_strength,
        "rsi": rsi,
        "volume_ratio": volume_ratio,
        "hv": hv,
        "ma25": ma25,
        "ma25_above_streak_days": ma25_above_streak_days,
    }


def fetch_technical_metrics(engine: Engine, symbol: str, benchmark_df: pd.DataFrame) -> dict | None:
    """1銘柄分の技術指標を取得する(価格履歴キャッシュを使うため高速)。"""
    df = _fetch_history(engine, symbol, HISTORY_PERIOD)
    if df is None:
        return None

    metrics = {"ticker_symbol": symbol}
    metrics.update(_fetch_technical_metrics(df, benchmark_df))
    return metrics


def run_technical_metrics_fetch(engine: Engine, symbols: list[str]) -> int:
    """symbolsの技術指標を取得し、stock_metricsへupsertする(基礎指標列は変更しない)。"""
    benchmark_df = _fetch_history(engine, BENCHMARK_SYMBOL, HISTORY_PERIOD)
    if benchmark_df is None:
        raise RuntimeError(f"Failed to fetch benchmark history for {BENCHMARK_SYMBOL}")

    saved = 0
    for batch in chunked(symbols):
        rows = []
        for symbol in batch:
            try:
                metrics = fetch_technical_metrics(engine, symbol, benchmark_df)
            except Exception:
                logger.exception("Failed to fetch technical metrics for %s", symbol)
                continue
            if metrics is not None:
                rows.append(metrics)
        if rows:
            with engine.begin() as conn:
                conn.execute(text(load_sql("upsert_stock_technical_metrics.sql")), rows)
            saved += len(rows)
            logger.info("Saved technical metrics for %d/%d symbols so far", saved, len(symbols))

    return saved


def run_metrics_fetch(engine: Engine, symbols: list[str]) -> int:
    """基礎指標+技術指標をまとめて取得する(手動実行・CLI用の便利関数)。"""
    saved = run_fundamentals_fetch(engine, symbols)
    run_technical_metrics_fetch(engine, symbols)
    return saved
