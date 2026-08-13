"""yfinance APIへの分割リクエスト共通処理。

一度に大量のレコードを取得しようとするとyfinanceのレスポンスが
返却されないことがあるため、取得対象が20件を超える場合は20件ごとに
APIリクエストを分割して取得する。この分割の仕様はyfinanceを使って
レコードを取得するすべてのメソッドで共通利用する。
"""

import logging
from collections.abc import Callable, Sequence

logger = logging.getLogger(__name__)

BATCH_SIZE = 20


def chunked(items: Sequence, batch_size: int = BATCH_SIZE):
    """itemsをbatch_size件ごとのリストに分割するジェネレータ。"""
    for i in range(0, len(items), batch_size):
        yield items[i : i + batch_size]


def fetch_paginated(
    fetch_page: Callable[[int, int], list[dict]], batch_size: int = BATCH_SIZE
) -> list[dict]:
    """offset/sizeを進めながらfetch_pageを呼び出し、結果がなくなるまで取得を続ける。"""
    records: list[dict] = []
    offset = 0
    while True:
        page = fetch_page(offset, batch_size)
        if not page:
            break
        records.extend(page)
        if len(page) < batch_size:
            break
        offset += batch_size
    return records
