"""ターゲットプライスの自動算出。

3つのロジックを用意する:
- eps_growth (ロジックA): 現在株価 × (1 + 予想EPS成長率)
- pbr_normalization (ロジックB): BPS × ターゲットPBR(既定1.0倍)
- analyst_consensus (ロジックC): アナリスト目標株価平均をそのまま採用

銘柄が属する有効なスクリーニンググループにauto_calc_logic_typeの指定があれば
それを優先し、必要なデータが揃わない場合は他のロジックへフォールバックする
(既定の優先順はC→A→Bとし、極端な理論値によるエラーを避けるため客観的な
アナリストコンセンサスを最優先する)。
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

DEFAULT_TARGET_PBR = 1.0
DEFAULT_LOGIC_ORDER = ("analyst_consensus", "eps_growth", "pbr_normalization")


def _calculate(
    logic_type: str,
    current_price: float | None,
    eps_growth: float | None,
    bps: float | None,
    target_mean_price: float | None,
) -> float | None:
    if logic_type == "eps_growth":
        if current_price is None or eps_growth is None:
            return None
        return current_price * (1 + eps_growth / 100)
    if logic_type == "pbr_normalization":
        if bps is None:
            return None
        return bps * DEFAULT_TARGET_PBR
    if logic_type == "analyst_consensus":
        return target_mean_price
    return None


def resolve_target_price(
    engine: Engine, ticker_symbol: str, base_price: float | None = None
) -> tuple[float | None, str | None]:
    """銘柄のターゲットプライスを算出する(所属グループのロジック優先、フォールバックあり)。

    base_priceを指定した場合、ロジックA(eps_growth)の基準価格としてそれを使う
    (購入時点のスナップショット用に、実際の約定価格を渡せるようにするため)。
    指定しない場合は直近の終値を使う(候補銘柄向けの現在値ベースの試算)。
    ロジックB/Cは価格を使わないため影響を受けない。

    戻り値は(算出値, 採用したロジック種別)。算出不能な場合は(None, None)。
    """
    with engine.connect() as conn:
        group_row = conn.execute(
            text(load_sql("select_stock_group_logic_type.sql")), {"ticker_symbol": ticker_symbol}
        ).mappings().first()
        metrics_row = conn.execute(
            text(load_sql("select_stock_metrics_for_target_price.sql")), {"ticker_symbol": ticker_symbol}
        ).mappings().first()

    if base_price is not None:
        current_price = base_price
    else:
        with engine.connect() as conn:
            price_row = conn.execute(
                text(load_sql("select_latest_close_price.sql")), {"ticker_symbol": ticker_symbol}
            ).mappings().first()
        current_price = float(price_row["close_price"]) if price_row and price_row["close_price"] is not None else None
    eps_growth = float(metrics_row["eps_growth"]) if metrics_row and metrics_row["eps_growth"] is not None else None
    bps = float(metrics_row["bps"]) if metrics_row and metrics_row["bps"] is not None else None
    target_mean_price = (
        float(metrics_row["target_mean_price"])
        if metrics_row and metrics_row["target_mean_price"] is not None
        else None
    )

    preferred_logic = group_row["auto_calc_logic_type"] if group_row else None
    logic_order = (
        (preferred_logic, *[logic for logic in DEFAULT_LOGIC_ORDER if logic != preferred_logic])
        if preferred_logic
        else DEFAULT_LOGIC_ORDER
    )

    for logic_type in logic_order:
        value = _calculate(logic_type, current_price, eps_growth, bps, target_mean_price)
        if value is not None:
            return round(value, 2), logic_type
    return None, None


def sync_target_prices(engine: Engine, ticker_symbols: list[str]) -> int:
    """対象銘柄のtarget_price_autoを再計算して保存する。算出できた件数を返す。"""
    saved = 0
    with engine.begin() as conn:
        for ticker_symbol in ticker_symbols:
            target_price, logic_type = resolve_target_price(engine, ticker_symbol)
            conn.execute(
                text(load_sql("update_target_price_auto.sql")),
                {
                    "ticker_symbol": ticker_symbol,
                    "target_price_auto": target_price,
                    "target_price_auto_logic": logic_type,
                },
            )
            if target_price is not None:
                saved += 1
    logger.info("sync_target_prices: calculated %d/%d target prices", saved, len(ticker_symbols))
    return saved


def snapshot_target_price_at_purchase(engine: Engine, ticker_symbol: str, purchase_price: float) -> float | None:
    """購入時点のターゲットプライスを算出し、以降固定の値としてスナップショット保存する。

    保有銘柄の利確判定は、現在値の変動につれて動いてしまうtarget_price_autoではなく、
    こちらの値を優先して使う(purchase_score/purchase_priceと同じ「購入時点固定」の考え方)。
    ロジックA(eps_growth)の基準価格には、直近終値ではなく実際の約定価格(purchase_price)
    を使う(そうしないと、購入後に株価が下落した場合に目標株価も一緒に下がってしまい、
    達成率が実態と無関係に押し上げられてしまう)。
    """
    target_price, logic_type = resolve_target_price(engine, ticker_symbol, base_price=purchase_price)
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("update_target_price_at_purchase.sql")),
            {
                "ticker_symbol": ticker_symbol,
                "target_price_at_purchase": target_price,
                "target_price_at_purchase_logic": logic_type,
            },
        )
    return target_price
