"""TDnet(東証の適時開示情報)から銘柄関連ニュース(決算短信・自己株買い等の適時開示)を
取得し、market_newsへ取り込む。

TDnet公式には検索APIが無いため、金融庁EDINET連携と同様に、非公式ラッパーAPI
(やのしんWEB-API、認証不要)を使う。証券コードをハイフンで連結すると複数銘柄を
まとめて取得できるため、追跡銘柄をまとめて1〜数回のリクエストで取得する。

取込は news_id(TDnetの開示ID)をキーにした冪等な取込(INSERT IGNORE)で、
重複取込を防ぐ(EDINET連携のedinet_filings台帳と同じ考え方)。
"""

import logging
import time
from datetime import datetime, timedelta

import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql
from scripts.yfinance_batch import chunked

logger = logging.getLogger(__name__)

TDNET_LIST_URL = "https://webapi.yanoshin.jp/webapi/tdnet/list/{condition}.json"
REQUEST_TIMEOUT = 30
REQUEST_INTERVAL_SECONDS = 1.0
# 1リクエストあたりの銘柄数(URL長・レスポンスサイズを抑えるため)。
TICKER_BATCH_SIZE = 50


def _ticker_to_company_code(ticker_symbol: str) -> str:
    """証券コード.T形式(例: 7203.T)をTDnetの銘柄コード(4桁、例: 7203)へ変換する。"""
    return ticker_symbol.split(".")[0]


def _company_code_to_ticker(company_code: str) -> str:
    """TDnetの銘柄コード(5桁、末尾0埋め、例: 72030)を証券コード.T形式へ変換する。"""
    return f"{company_code[:4]}.T"


def fetch_disclosures(ticker_symbols: list[str]) -> list[dict]:
    """指定した銘柄群の適時開示情報一覧を取得する(複数銘柄はハイフン連結で1回に集約)。"""
    if not ticker_symbols:
        return []
    codes = "-".join(_ticker_to_company_code(t) for t in ticker_symbols)
    url = TDNET_LIST_URL.format(condition=codes)
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return [item["Tdnet"] for item in data.get("items", [])]


def sync_news(engine: Engine, ticker_symbols: list[str], lookback_days: int) -> dict:
    """追跡銘柄の適時開示情報を取得し、直近lookback_days分をmarket_newsへ取り込む。"""
    cutoff = datetime.now() - timedelta(days=lookback_days)
    tracked = set(ticker_symbols)
    fetched = 0
    saved = 0

    for batch in chunked(ticker_symbols, TICKER_BATCH_SIZE):
        try:
            disclosures = fetch_disclosures(batch)
        except Exception:
            logger.warning("Failed to fetch TDnet disclosures for batch starting with %s", batch[0], exc_info=True)
            continue
        time.sleep(REQUEST_INTERVAL_SECONDS)
        fetched += len(disclosures)

        rows = []
        for d in disclosures:
            try:
                published_at = datetime.strptime(d["pubdate"], "%Y-%m-%d %H:%M:%S")
            except (KeyError, ValueError):
                continue
            if published_at < cutoff:
                continue
            ticker = _company_code_to_ticker(d["company_code"])
            if ticker not in tracked:
                continue
            rows.append(
                {
                    "news_id": d["id"],
                    "ticker_symbol": ticker,
                    "company_name": d.get("company_name"),
                    "title": d.get("title"),
                    "url": d.get("document_url"),
                    "published_at": published_at,
                }
            )

        if rows:
            with engine.begin() as conn:
                conn.execute(text(load_sql("insert_market_news.sql")), rows)
            saved += len(rows)

    return {"tickers": len(ticker_symbols), "fetched": fetched, "saved": saved}
