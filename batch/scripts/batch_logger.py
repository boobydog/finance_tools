"""batch_logsテーブルによる実行ログとリトライ間隔の管理。

リトライ戦略: 5分、30分、1時間の間隔で最大3回実施。コンテナが再起動しても、
直前の実行状態はbatch_logsから復元する。そのため、リトライ待機はプロセス内で
sleepするのではなく、次回このバッチが呼び出された際にget_next_attemptで
「まだ実行すべきタイミングでないか」を判定する形を取る(cronなどで定期的に
呼び出されることを前提とする)。
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

RETRY_INTERVALS = [timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=1)]
MAX_RETRY_COUNT = len(RETRY_INTERVALS)
DEFAULT_MIN_RUN_INTERVAL = timedelta(hours=24)


def get_next_attempt(
    engine: Engine, process_name: str, min_run_interval: timedelta = DEFAULT_MIN_RUN_INTERVAL
) -> int | None:
    """次に実行すべき試行のretry_countを返す。まだ実行すべきタイミングでなければNoneを返す。

    cronなどで頻繁に(リトライ間隔に合わせて5分おきなどで)呼び出される想定のため、
    前回成功からmin_run_interval未満しか経っていない場合は新規実行を行わない。
    """
    with engine.connect() as conn:
        row = conn.execute(
            text(load_sql("select_latest_batch_log.sql")), {"process_name": process_name}
        ).mappings().first()

    if row is None:
        return 0

    if row["status"] == "SUCCESS":
        next_run_at = row["updated_at"] + min_run_interval
        if datetime.utcnow() < next_run_at:
            return None
        return 0

    retry_count = row["retry_count"]
    if retry_count >= MAX_RETRY_COUNT:
        logger.error(
            "Retry limit reached for %s (retry_count=%d), not attempting again",
            process_name, retry_count,
        )
        return None

    # DBサーバーはUTCで動作している前提(batch_logs.updated_atもUTC)のため、
    # ローカルタイムゾーンに影響されないdatetime.utcnow()で比較する。
    due_at = row["updated_at"] + RETRY_INTERVALS[retry_count]
    if datetime.utcnow() < due_at:
        logger.info(
            "%s is not due for retry yet (next attempt at %s)", process_name, due_at
        )
        return None

    return retry_count + 1


def start(engine: Engine, process_name: str, retry_count: int) -> int:
    """実行開始を記録し、log_idを返す。"""
    status = "RETRYING" if retry_count > 0 else "RUNNING"
    with engine.begin() as conn:
        result = conn.execute(
            text(load_sql("insert_batch_log.sql")),
            {"process_name": process_name, "status": status, "retry_count": retry_count},
        )
        return result.lastrowid


def finish_success(engine: Engine, log_id: int) -> None:
    """成功を記録する。"""
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("update_batch_log.sql")),
            {"log_id": log_id, "status": "SUCCESS", "error_message": None},
        )


def finish_failure(engine: Engine, log_id: int, error_message: str) -> None:
    """失敗を記録する。"""
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("update_batch_log.sql")),
            {"log_id": log_id, "status": "FAILED", "error_message": error_message},
        )
