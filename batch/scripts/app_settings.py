"""app_settingsテーブル(key-value)による、アプリ全体の小さな設定値の取得・更新。"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

TECHNICAL_SCORE_CANDIDATE_THRESHOLD_KEY = "technical_score_candidate_threshold"
DEFAULT_TECHNICAL_SCORE_CANDIDATE_THRESHOLD = 60

TRAILING_STOP_ALLOWANCE_PERCENT_KEY = "trailing_stop_allowance_percent"
DEFAULT_TRAILING_STOP_ALLOWANCE_PERCENT = 10


def get_int_setting(engine: Engine, key: str, default: int) -> int:
    with engine.connect() as conn:
        row = conn.execute(text(load_sql("select_app_setting.sql")), {"setting_key": key}).mappings().first()
    return int(row["setting_value"]) if row else default


def set_setting(engine: Engine, key: str, value: str | int) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("upsert_app_setting.sql")), {"setting_key": key, "setting_value": str(value)}
        )


def get_technical_score_candidate_threshold(engine: Engine) -> int:
    return get_int_setting(
        engine, TECHNICAL_SCORE_CANDIDATE_THRESHOLD_KEY, DEFAULT_TECHNICAL_SCORE_CANDIDATE_THRESHOLD
    )


def get_trailing_stop_allowance_percent(engine: Engine) -> int:
    return get_int_setting(
        engine, TRAILING_STOP_ALLOWANCE_PERCENT_KEY, DEFAULT_TRAILING_STOP_ALLOWANCE_PERCENT
    )
