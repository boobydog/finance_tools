"""スクリーニング条件(screening_groups/screening_rules)とJSONファイルの相互変換。

DBを常に正とし、JSONはPythonバッチが読み込むための書き出し専用のスナップショットとして扱う。
API(batch/api)とバッチ(main.py)の両方から共通で使うため、ここに集約している。

1つのグループは、用途(rule_purpose)別に4種類のルールセットを持つ:
- candidate: 候補スクリーニング(自動候補化)用。screening_engine.evaluate_and_applyが使う。
- entry_timing / loss_cut / profit_taking: 買入タイミング/損切り/利確判定用。
  trade_judgment_engine.pyが、銘柄のタグ(根拠グループ名)に一致するグループ、
  なければis_default=TRUEのグループの基準で評価する。

JSON入出力(スクリーニング設定画面のインポート/エクスポート)は、候補スクリーニング用
ルール(rule_purpose='candidate')のみを対象とし、削除不可のデフォルトグループおよび
買入タイミング/損切り/利確用ルールは対象外(総入れ替え時も保持される)。

JSON構造(A/B/C階層):
{
  "generatedAt": "2026-08-13T10:00:00+00:00",
  "groups": [
    {
      "groupId": 1,
      "name": "高配当戦略",
      "description": "...",
      "rules": {
        "A": [{"paramKey": "...", "operator": "gte", "value": 10}],
        "B": [...],
        "C": [...]
      }
    }
  ]
}
"""

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

CATEGORIES = ("A", "B", "C")
RULE_PURPOSES = ("candidate", "entry_timing", "loss_cut", "profit_taking")


def fetch_param_definitions(engine: Engine) -> list[dict]:
    """screening_param_definitionsの一覧を取得する。"""
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_screening_param_definitions.sql"))).mappings().all()
    return [dict(row) for row in rows]


def _empty_rules() -> dict[str, dict[str, list[dict]]]:
    return {purpose: {c: [] for c in CATEGORIES} for purpose in RULE_PURPOSES}


def fetch_screening_groups_hierarchical(engine: Engine) -> dict:
    """screening_groups/screening_rulesを用途別×A/B/C階層のdictとして取得する。"""
    with engine.connect() as conn:
        group_rows = conn.execute(text(load_sql("select_screening_groups.sql"))).mappings().all()
        rule_rows = conn.execute(text(load_sql("select_screening_rules.sql"))).mappings().all()

    rules_by_group: dict[int, dict[str, dict[str, list[dict]]]] = defaultdict(_empty_rules)
    for row in rule_rows:
        rules_by_group[row["group_id"]][row["rule_purpose"]][row["category"]].append(
            {
                "paramKey": row["param_key"],
                "operator": row["operator"],
                "valueMode": row["value_mode"],
                "value": float(row["min_threshold"]) if row["min_threshold"] is not None else None,
            }
        )

    groups = [
        {
            "groupId": row["group_id"],
            "name": row["name"],
            "description": row["description"],
            "isActive": bool(row["is_active"]),
            "purpose": row["purpose"],
            "isDefault": bool(row["is_default"]),
            "candidateScreeningActive": bool(row["candidate_screening_active"]),
            "signalCountThreshold": row["signal_count_threshold"],
            "holdingPeriodExitDays": row["holding_period_exit_days"],
            "trailingStopAllowancePercent": row["trailing_stop_allowance_percent"],
            "rules": rules_by_group.get(row["group_id"], _empty_rules()),
        }
        for row in group_rows
    ]

    return {"generatedAt": datetime.now(timezone.utc).isoformat(), "groups": groups}


def export_screening_rules_json(engine: Engine, path: str | Path) -> dict:
    """DBの候補スクリーニング条件(デフォルトグループ以外)をJSONファイルへ書き出す。"""
    all_groups = fetch_screening_groups_hierarchical(engine)["groups"]
    exportable_groups = [
        {**g, "rules": g["rules"]["candidate"]} for g in all_groups if not g["isDefault"]
    ]
    data = {"generatedAt": datetime.now(timezone.utc).isoformat(), "groups": exportable_groups}
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Exported screening rules -> %s (%d groups)", output_path, len(data["groups"]))
    return data


def replace_screening_rules_from_data(engine: Engine, data: dict) -> dict:
    """JSON(A/B/C階層)の内容で、候補スクリーニング用のDBグループ/ルールを総入れ替えする。

    削除不可のデフォルトグループ、および買入タイミング/損切り/利確用ルールは対象外。
    """
    with engine.begin() as conn:
        conn.execute(text(load_sql("delete_all_screening_rules.sql")))
        conn.execute(text(load_sql("delete_all_screening_groups.sql")))

        for group in data.get("groups", []):
            result = conn.execute(
                text(load_sql("insert_screening_group.sql")),
                {
                    "name": group["name"],
                    "description": group.get("description"),
                    "is_active": group.get("isActive", True),
                },
            )
            group_id = result.lastrowid

            rule_params = [
                {
                    "group_id": group_id,
                    "rule_purpose": "candidate",
                    "category": category,
                    "param_key": rule["paramKey"],
                    "operator": rule["operator"],
                    "value_mode": rule.get("valueMode", "fixed"),
                    "param_value": rule.get("value"),
                }
                for category in CATEGORIES
                for rule in group.get("rules", {}).get(category, [])
            ]
            if rule_params:
                conn.execute(text(load_sql("insert_screening_rule.sql")), rule_params)

    logger.info("Imported screening rules from JSON (%d groups)", len(data.get("groups", [])))
    return fetch_screening_groups_hierarchical(engine)
