"""screening_groups/screening_rules(A/B/C分類)を実際の銘柄データに照らして評価し、
判定結果をuser_stock_status/tagsへ反映する判定エンジン。

方針:
- 分類A(原則禁止)・分類B(理由なき場合回避)のルールが1つでも該当する場合、
  その銘柄はそのスクリーニンググループの候補としては不適格とみなす。
  分類C(条件次第)は判定のみでブロックはしない(参考情報)。
- いずれかのグループで不適格に該当しなかった銘柄を「候補(interested)」として
  user_stock_statusへ反映し、根拠となったグループ名をタグとして付与する。
- 既にステータスが設定されている銘柄(手動で購入/売却/除外/候補にした銘柄)は
  上書きしない。判定エンジンは「未設定」の銘柄にのみ候補を追加する。
- 該当パラメータの実データ(stock_metrics)がNoneの場合、そのルールは
  「判定不能」としてスキップする(ブロック扱いにはしない)。
- グループを無効化した場合、そのグループのみが根拠で「候補」になっていた銘柄は
  ステータス・タグをリセットし、有効なグループのみで再評価し直す
  (reconcile_inactive_group_candidates)。他の有効なグループにも該当していた銘柄や、
  手動でステータスを設定した銘柄(タグを一切持たない候補等)には触れない。
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.screening_config import CATEGORIES, fetch_screening_groups_hierarchical
from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

BLOCKING_CATEGORIES = ("A", "B")
CANDIDATE_TAG_COLOR = "#3ea6ff"


def _evaluate_condition(
    metric_value: float | bool | None,
    operator: str,
    rule_value: float | None,
    value_mode: str = "fixed",
    hv: float | None = None,
) -> bool:
    """ルールが「該当する(=ブロック対象になる)」かどうかを返す。判定不能ならFalse。

    value_mode="hv_multiplier"の場合、rule_valueは固定閾値ではなく銘柄自身のHVに
    対する倍率として扱う(実際の閾値 = rule_value × hv)。
    """
    if metric_value is None or rule_value is None:
        return False
    if value_mode == "hv_multiplier":
        if hv is None:
            return False
        rule_value = rule_value * float(hv)
    if operator == "gte":
        return float(metric_value) >= rule_value
    if operator == "lte":
        return float(metric_value) <= rule_value
    if operator == "eq":
        return bool(metric_value) == bool(rule_value)
    return False


def _passes_group(stock_row: dict, group: dict) -> bool:
    candidate_rules = group["rules"].get("candidate", {})
    for category in BLOCKING_CATEGORIES:
        for rule in candidate_rules.get(category, []):
            metric_value = stock_row.get(rule["paramKey"])
            if _evaluate_condition(
                metric_value, rule["operator"], rule["value"], rule.get("valueMode", "fixed"), stock_row.get("hv")
            ):
                return False
    return True


def _get_or_create_tag(conn, name: str) -> int:
    row = conn.execute(text(load_sql("select_tag_by_name.sql")), {"name": name}).mappings().first()
    if row:
        return row["tag_id"]
    result = conn.execute(text(load_sql("insert_tag.sql")), {"name": name, "color": CANDIDATE_TAG_COLOR})
    return result.lastrowid


def reconcile_inactive_group_candidates(engine: Engine) -> int:
    """無効化されたグループのみを根拠に「候補」になっている銘柄をリセットする。

    リセット対象 = status='interested' かつ、有効なグループのタグを1つも持たない銘柄
    (無効グループのタグは持っている場合のみ)。手動でステータス設定した銘柄はタグを
    持たないため対象外、他の有効グループにも該当する銘柄はタグが残るため対象外。
    リセット後はuser_stock_status/stock_tagsを削除し、次のevaluate_and_appliで
    有効なグループのみで再評価される(=未設定銘柄として扱われる)。
    """
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_stale_inactive_group_candidates.sql"))).mappings().all()
    ticker_symbols = [row["ticker_symbol"] for row in rows]

    if ticker_symbols:
        with engine.begin() as conn:
            for ticker_symbol in ticker_symbols:
                conn.execute(text(load_sql("delete_stock_tags_by_ticker.sql")), {"ticker_symbol": ticker_symbol})
                conn.execute(
                    text(load_sql("delete_user_stock_status_by_ticker.sql")), {"ticker_symbol": ticker_symbol}
                )
        logger.info("reconcile_inactive_group_candidates: reset %d stocks", len(ticker_symbols))

    return len(ticker_symbols)


def evaluate_and_apply(engine: Engine) -> dict:
    """未設定の銘柄をscreening_groupsで評価し、候補と判定された銘柄をuser_stock_status/tagsへ反映する。"""
    reset_count = reconcile_inactive_group_candidates(engine)

    groups = fetch_screening_groups_hierarchical(engine)["groups"]
    groups_with_rules = [
        g
        for g in groups
        if g["isActive"]
        and g["candidateScreeningActive"]
        and any(g["rules"].get("candidate", {}).get(c) for c in CATEGORIES)
    ]

    with engine.connect() as conn:
        stock_rows = conn.execute(text(load_sql("select_stocks_with_metrics_untouched.sql"))).mappings().all()

    evaluated = 0
    candidates: dict[str, list[str]] = {}
    for row in stock_rows:
        evaluated += 1
        matched_groups = [g["name"] for g in groups_with_rules if _passes_group(row, g)]
        if matched_groups:
            candidates[row["ticker_symbol"]] = matched_groups

    with engine.begin() as conn:
        tag_id_by_group: dict[str, int] = {}
        for ticker_symbol, group_names in candidates.items():
            conn.execute(
                text(load_sql("upsert_user_stock_status.sql")),
                {"ticker_symbol": ticker_symbol, "status": "interested"},
            )
            for group_name in group_names:
                if group_name not in tag_id_by_group:
                    tag_id_by_group[group_name] = _get_or_create_tag(conn, group_name)
                conn.execute(
                    text(load_sql("insert_stock_tag.sql")),
                    {"ticker_symbol": ticker_symbol, "tag_id": tag_id_by_group[group_name]},
                )

    result = {
        "groups_evaluated": len(groups_with_rules),
        "stocks_evaluated": evaluated,
        "candidates": len(candidates),
        "reset_by_inactive_group": reset_count,
    }
    logger.info("Screening engine result: %s", result)
    return result
