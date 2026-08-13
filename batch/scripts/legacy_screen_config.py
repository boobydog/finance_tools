"""旧stock_screener.py用のyfinanceスクリーナー条件JSON
(config/screen_conditions*.json)を、新しいA/B/C分類のscreening_groups形式へ
変換して取り込む。

旧形式はyfinanceの組み込みスクリーナーへ渡すクエリ(sector・時価総額・取引所などで
「どの銘柄群を見るか」を絞り込むフィルタ)であり、新形式(screening_rules)の
「個別銘柄を買うか避けるか判定する条件」とは性質が異なる。
そのため、数値の閾値条件(gte/lte/eq)のみ機械的に変換できる場合は変換し、
文字列・配列を扱う条件(sector=Technology, exchange in [...] 等)は変換できない旨を
グループの説明文に残す(判定は分類C(条件次第)の情報としてのみ扱い、ブロックはしない)。
"""

import json
import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

# 旧yfinanceスクリーナーのfield名 -> screening_param_definitions.param_key
FIELD_TO_PARAM_KEY = {
    "intradaymarketcap": "market_cap",
}


def convert_legacy_config(data: dict) -> tuple[list[dict], list[str]]:
    """変換できたルール一覧と、変換できなかった条件の説明文一覧を返す。"""
    rules: list[dict] = []
    unsupported: list[str] = []

    conditions = data.get("query", {}).get("conditions", [])
    for cond in conditions:
        field = cond.get("field")
        operator = cond.get("operator")
        value = cond.get("value")
        param_key = FIELD_TO_PARAM_KEY.get(field)

        if param_key and operator in ("gte", "lte", "eq") and isinstance(value, (int, float)):
            rules.append({"category": "C", "param_key": param_key, "operator": operator, "param_value": value})
        else:
            unsupported.append(f"{field} {operator} {value}")

    return rules, unsupported


def import_legacy_screen_config(engine: Engine, path: str | Path, group_name: str) -> dict:
    """旧形式のJSONファイルを読み込み、新しいscreening_groupとして取り込む。"""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    rules, unsupported = convert_legacy_config(data)

    description = f"{Path(path).name} から自動変換。"
    if unsupported:
        description += (
            "以下の条件は新形式(数値の閾値のみ)では表現できず変換されませんでした: "
            + "; ".join(unsupported)
        )

    with engine.begin() as conn:
        result = conn.execute(
            text(load_sql("insert_screening_group.sql")), {"name": group_name, "description": description}
        )
        group_id = result.lastrowid
        for rule in rules:
            conn.execute(
                text(load_sql("insert_screening_rule.sql")),
                {
                    "group_id": group_id,
                    "category": rule["category"],
                    "param_key": rule["param_key"],
                    "operator": rule["operator"],
                    "param_value": rule["param_value"],
                },
            )

    logger.info(
        "Imported legacy screen config %s -> group_id=%d (%d rules converted, %d unsupported)",
        path, group_id, len(rules), len(unsupported),
    )
    return {"group_id": group_id, "rules_converted": len(rules), "unsupported": unsupported}
