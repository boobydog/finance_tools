"""MySQLへの接続を提供する。

接続情報は環境変数(DB_HOST, DB_PORT, DB_USER, DB_NAME, DB_PASSWORD_FILE
または DB_PASSWORD)から取得する。未設定の場合はmysql/client.cnfと同じ
開発用デフォルト値を使う。
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

_engine: Engine | None = None


def _read_password() -> str:
    password_file = os.environ.get("DB_PASSWORD_FILE")
    if password_file:
        return Path(password_file).read_text(encoding="utf-8").strip()
    return os.environ.get("DB_PASSWORD", "finance_tools")


def get_engine() -> Engine:
    """SQLAlchemyのEngineを取得する(初回呼び出し時に生成し、以降は再利用する)。"""
    global _engine
    if _engine is None:
        host = os.environ.get("DB_HOST", "127.0.0.1")
        port = os.environ.get("DB_PORT", "3306")
        user = os.environ.get("DB_USER", "finance_tools")
        name = os.environ.get("DB_NAME", "finance_tools")
        password = _read_password()
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"
        _engine = create_engine(url)
    return _engine
