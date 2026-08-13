"""batch/sql配下のSQLファイルを読み込み実行する共通処理。

ロジックの透明性を保つため、複雑な処理はPythonで行わずSQLファイル側に
記述し、Pythonからはその呼び出しと結果のハンドリングのみを行う。
"""

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"


def load_sql(filename: str) -> str:
    """SQLファイルの内容を読み込む。"""
    return (SQL_DIR / filename).read_text(encoding="utf-8")


def execute_many(engine: Engine, filename: str, params_list: list[dict]) -> None:
    """SQLファイルをparams_listの各要素で繰り返し実行する。"""
    if not params_list:
        return
    statement = text(load_sql(filename))
    with engine.begin() as conn:
        conn.execute(statement, params_list)
