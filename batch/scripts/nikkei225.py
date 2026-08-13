"""日経平均株価(日経225)の構成銘柄を日経公式サイトから取得する。"""

import logging
from io import BytesIO

import pandas as pd
import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

WEIGHT_CSV_URL = (
    "https://indexes.nikkei.co.jp/nkave/archives/file/nikkei_stock_average_weight_jp.csv"
)
REQUEST_TIMEOUT = 30


def fetch_constituents() -> list[dict]:
    """日経225の構成銘柄(コード・社名・業種・セクター・ウエート)を取得する。"""
    response = requests.get(WEIGHT_CSV_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    df = pd.read_csv(BytesIO(response.content), encoding="cp932")
    df = df.dropna(subset=["コード"])
    return [
        {
            "ticker_symbol": f"{row['コード']}.T",
            "name": row["社名"],
            "sector": row["セクター"],
            "weight_percent": float(str(row["ウエート"]).rstrip("%")),
        }
        for _, row in df.iterrows()
    ]


def fetch_constituent_symbols() -> list[str]:
    """日経225構成銘柄のティッカーシンボル一覧を取得する。"""
    return [c["ticker_symbol"] for c in fetch_constituents()]


def sync_is_nikkei225_flag(engine: Engine, symbols: list[str]) -> None:
    """stocks.is_nikkei225を最新の構成銘柄一覧に合わせて更新する(銘柄管理は日経225のみを表示するため)。"""
    with engine.begin() as conn:
        conn.execute(text(load_sql("reset_nikkei225_flags.sql")))
        if symbols:
            conn.execute(
                text(load_sql("mark_nikkei225.sql")), [{"ticker_symbol": s} for s in symbols]
            )
