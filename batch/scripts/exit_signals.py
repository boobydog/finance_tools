"""損切り・利確判定画面向けのシグナル計算。

トレイリングストップは「保有期間中の最高値」を毎日更新し続ける必要があるため、
その更新処理をここに集約する(最高値の初期化は購入時にAPI側でpurchase_priceとして行う)。
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)


def sync_highest_prices(engine: Engine) -> None:
    """保有中銘柄のhighest_price_since_purchaseを、最新のキャッシュ済み終値で更新する。"""
    with engine.begin() as conn:
        conn.execute(text(load_sql("update_highest_price_since_purchase.sql")))
