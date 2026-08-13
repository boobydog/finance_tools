"""yfinanceを使った株価データ取得モジュール。

指定銘柄のリアルタイム情報・過去情報をyfinance経由で取得し、
配列(list[dict])として返す。CSV出力などのI/O処理は行わない。
"""

import logging

import yfinance as yf

from scripts.yfinance_batch import chunked

logger = logging.getLogger(__name__)


def fetch_realtime(symbols: list[str]) -> list[dict]:
    """指定銘柄のリアルタイム情報を取得し、配列(list[dict])として返す。"""
    records: list[dict] = []
    for batch in chunked(symbols):
        for symbol in batch:
            try:
                info = yf.Ticker(symbol).fast_info
            except Exception:
                logger.exception("Failed to fetch realtime info for %s", symbol)
                continue
            records.append({
                "symbol": symbol,
                "price": info.get("lastPrice"),
                "previous_close": info.get("previousClose"),
                "open": info.get("open"),
                "day_high": info.get("dayHigh"),
                "day_low": info.get("dayLow"),
                "volume": info.get("lastVolume"),
                "currency": info.get("currency"),
            })
    return records


def fetch_info(symbols: list[str]) -> list[dict]:
    """指定銘柄の基本情報を取得し、配列(list[dict])として返す。"""
    records: list[dict] = []
    for batch in chunked(symbols):
        for symbol in batch:
            try:
                info = yf.Ticker(symbol).info
            except Exception:
                logger.exception("Failed to fetch info for %s", symbol)
                continue
            records.append({
                "symbol": symbol,
                "name": info.get("longName") or info.get("shortName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "exchange": info.get("exchange"),
                "currency": info.get("currency"),
                "country": info.get("country"),
                "market_cap": info.get("marketCap"),
                "shares_outstanding": info.get("sharesOutstanding"),
                "employees": info.get("fullTimeEmployees"),
                "website": info.get("website"),
            })
    return records


def fetch_history(symbols: list[str], period: str, interval: str) -> list[dict]:
    """指定銘柄の過去情報を取得し、配列(list[dict])として返す。"""
    records: list[dict] = []
    for batch in chunked(symbols):
        for symbol in batch:
            df = yf.Ticker(symbol).history(period=period, interval=interval)
            if df.empty:
                logger.warning("No historical data returned for %s", symbol)
                continue
            df = df.reset_index()
            df.insert(0, "symbol", symbol)
            records.extend(df.to_dict(orient="records"))
    return records
