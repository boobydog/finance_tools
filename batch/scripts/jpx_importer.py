"""JPX(日本取引所グループ)公式サイトから銘柄一覧・監理/整理銘柄情報を取得し、
stocksテーブルへ反映するバッチ処理。

銘柄一覧は data_j.xls (Excel, Code page 932) として配布されているため、
Shift-JISのCSVとしてではなくpandas+xlrdで読み込む。

監理・整理銘柄は指定履歴(1レコード=1回の指定/解除イベント)のHTMLテーブルとして
公開されているため、銘柄コードごとに最も新しい指定年月日のレコードを採用し、
それが解除されていなければ現在も監理銘柄・整理銘柄であるとみなす。
"""

import logging
from io import BytesIO

import pandas as pd
import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import execute_many, load_sql

logger = logging.getLogger(__name__)

LISTED_STOCKS_URL = (
    "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls"
)
SUPERVISION_URL = "https://www.jpx.co.jp/listing/market-alerts/supervision/01.html"

_DOMESTIC_EQUITY_SEGMENTS = {"プライム（内国株式）", "スタンダード（内国株式）", "グロース（内国株式）"}

REQUEST_TIMEOUT = 30


def fetch_listed_stocks() -> list[dict]:
    """JPX公式サイトから国内株式(プライム/スタンダード/グロース)の銘柄一覧を取得する。"""
    response = requests.get(LISTED_STOCKS_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    df = pd.read_excel(BytesIO(response.content), engine="xlrd")
    df = df[df["市場・商品区分"].isin(_DOMESTIC_EQUITY_SEGMENTS)]
    return [
        {
            "ticker_symbol": f"{row['コード']}.T",
            "name": row["銘柄名"],
            "market_segment": row["市場・商品区分"],
            "sector": row["33業種区分"],
        }
        for _, row in df.iterrows()
    ]


def fetch_supervision_status() -> list[dict]:
    """現在有効な監理銘柄・整理銘柄の指定状況を取得する。"""
    response = requests.get(SUPERVISION_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    df = pd.read_html(BytesIO(response.content))[0]

    df["指定年月日"] = pd.to_datetime(df["指定年月日"], format="%Y/%m/%d")
    latest = df.sort_values("指定年月日").groupby("コード", as_index=False).last()
    active = latest[latest["解除年月日"] == "-"]

    return [
        {
            "ticker_symbol": f"{row['コード']}.T",
            "is_under_supervision": "監理銘柄" in row["内容"],
            "is_delisting_risk": "整理銘柄" in row["内容"],
        }
        for _, row in active.iterrows()
    ]


def import_stocks(engine: Engine) -> dict:
    """銘柄一覧と監理/整理銘柄の指定状況をstocksテーブルへ反映する。"""
    stocks = fetch_listed_stocks()
    execute_many(engine, "upsert_stocks.sql", stocks)

    supervision = fetch_supervision_status()
    with engine.begin() as conn:
        conn.execute(text(load_sql("reset_supervision_flags.sql")))
    under_supervision = [r for r in supervision if r["is_under_supervision"]]
    delisting_risk = [r for r in supervision if r["is_delisting_risk"]]
    execute_many(
        engine, "set_under_supervision.sql",
        [{"ticker_symbol": r["ticker_symbol"]} for r in under_supervision],
    )
    execute_many(
        engine, "set_delisting_risk.sql",
        [{"ticker_symbol": r["ticker_symbol"]} for r in delisting_risk],
    )

    return {
        "stocks": len(stocks),
        "under_supervision": len(under_supervision),
        "delisting_risk": len(delisting_risk),
    }
