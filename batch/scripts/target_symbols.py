"""screening_engineの対象となる銘柄群(候補/保有/除外 + 日経225構成銘柄)を解決する。

画面操作トリガーの自動パイプライン(pipeline.py)とcronバッチ(main.py)の両方が
共通して使う対象銘柄の定義をここに集約する。
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.nikkei225 import fetch_constituent_symbols, sync_is_nikkei225_flag
from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)


def get_tracked_ticker_symbols(engine: Engine) -> list[str]:
    """候補/保有/除外銘柄(user_stock_statusに行がある銘柄)のティッカーシンボル一覧を返す。"""
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_tracked_ticker_symbols.sql"))).mappings().all()
    return sorted({row["ticker_symbol"] for row in rows})


def resolve_target_symbols(engine: Engine) -> list[str]:
    """候補/保有/除外銘柄 + 日経225構成銘柄の和集合を返す。あわせてis_nikkei225フラグも同期する。"""
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_tracked_ticker_symbols.sql"))).mappings().all()
    symbols = {row["ticker_symbol"] for row in rows}

    try:
        nikkei225_symbols = fetch_constituent_symbols()
        symbols |= set(nikkei225_symbols)
        sync_is_nikkei225_flag(engine, nikkei225_symbols)
    except Exception:
        logger.exception("resolve_target_symbols: fetch nikkei225 constituents failed")

    return sorted(symbols)
