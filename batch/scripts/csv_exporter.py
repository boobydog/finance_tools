"""CSV出力・保管期限管理モジュール。

stock_fetcherなどが取得した配列(list[dict])をCSVファイルへ出力し、
保管期間(既定30日)を過ぎたCSVファイルを削除する。
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

CSV_DIR = Path(__file__).resolve().parent.parent / "data" / "history"
CSV_RETENTION_DAYS = 30


def export_csv(records: list[dict], filename: str) -> Path | None:
    """配列(list[dict])を受け取り、CSVファイルとして出力する。"""
    if not records:
        logger.warning("No records to export, skipping CSV output")
        return None
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    path = CSV_DIR / filename
    pd.DataFrame(records).to_csv(path, index=False)
    logger.info("Saved %d rows -> %s", len(records), path)
    return path


def cleanup_old_csv(retention_days: int = CSV_RETENTION_DAYS) -> None:
    """保管期間(既定30日)を過ぎたCSVファイルを削除する。"""
    if not CSV_DIR.exists():
        return
    cutoff = datetime.now() - timedelta(days=retention_days)
    for path in CSV_DIR.glob("*.csv"):
        if datetime.fromtimestamp(path.stat().st_mtime) < cutoff:
            path.unlink()
            logger.info("Deleted expired CSV: %s", path)
