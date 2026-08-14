"""screening_groups/screening_rules(rule_purpose別)を使い、買入タイミング(entry_timing)・
損切り(loss_cut)・利確(profit_taking)の判定基準をグループ単位で評価する判定エンジン。

1つのグループ(戦略、例: 中型株)は、候補スクリーニング用のルールとは別に、
entry_timing/loss_cut/profit_taking用のルールセットも持つ(screening_config.pyのrules構造:
{purpose: {category: [rule, ...]}})。screening_engine.py(候補発見/A・B分類でブロック判定)
とはrule_purposeで完全に分離しており、こちらのA/B/C分類は以下のように解釈する:
- entry_timing: 分類Cの各ルールのうち条件を満たした数を数え、
  signal_count_threshold以上なら「有力候補」とする。
- loss_cut: 分類Aのいずれかを満たせば優先度A(即時売却)、満たさず分類Bの
  いずれかを満たせば優先度B(回避・撤退検討)。
- profit_taking: 分類Aのいずれかを満たせば「売却検討」とする(手数料・税引後の
  純損益が黒字である場合のみ有効。マイナスなら利確シグナルとして扱わない)。

保有期間満了による強制決済は、上記の損切り・利確とは別の第3の判定軸として扱う
(evaluate_holding_period_exit)。損益に関わらず機械的に決済する規律ルールのため、
利確判定のA/Bルールエンジンには含めず、また純損益ゲートの対象外とする
(通常のprofit_takingと混ぜると、含み損の状態で期間満了した場合に純損益ゲートで
握りつぶされ、「損益に関わらず決済する」という本来の趣旨に反してしまうため)。

evaluate_entryは、買入タイミングの分類A/Cとは別に、同じグループのloss_cut分類A/Bも
先読みで評価する(「今日この銘柄を買ったら、購入直後に損切り対象にならないか」)。
評価対象のrowには購入価格・購入時スコアが存在しないため、それらに依存する条件
(drawdown_percent・score_diffなど)は自動的に不成立となり、銘柄自体の状態を示す条件
(上場廃止リスク・監理銘柄・営業利益/EPS成長率の悪化など)のみが働く。loss_cut分類A相当は
候補から除外、分類B相当は警告表示のみ(除外はしない)。損切り判定用の閾値をそのまま
再利用するため、entry_timing側に同じ条件を別途登録する必要はない。

グループ解決方針:
- 銘柄が持つタグ(=候補になった時の根拠グループ名)のうち、有効なグループに一致する
  ものがあれば、そのグループの基準を使う(複数該当時はgroup_idが小さい方を優先)。
  一致したグループの基準のみが使われ、そのグループにルールがない場合でも
  デフォルトグループへはフォールバックしない(グループ設定が優先されるため)。
- タグが一致するグループがなければ、is_default=TRUEの削除不可グループにフォールバックする。
- 有効なグループが1件も存在しなければNoneを返す(未設定として扱う)。
"""

from collections import defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.screening_config import fetch_screening_groups_hierarchical
from scripts.sql_runner import load_sql

JST = ZoneInfo("Asia/Tokyo")


def _evaluate_condition(
    metric_value: float | bool | None,
    operator: str,
    rule_value: float | None,
    value_mode: str = "fixed",
    hv: float | None = None,
) -> bool:
    """value_mode="hv_multiplier"の場合、rule_valueは固定閾値ではなく銘柄自身のHVに
    対する倍率として扱う(実際の閾値 = rule_value × hv)。"""
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


def _count_matches(row: dict, rules: list[dict]) -> int:
    hv = row.get("hv")
    return sum(
        1
        for rule in rules
        if _evaluate_condition(row.get(rule["paramKey"]), rule["operator"], rule["value"], rule.get("valueMode", "fixed"), hv)
    )


def _any_matches(row: dict, rules: list[dict]) -> bool:
    hv = row.get("hv")
    return any(
        _evaluate_condition(row.get(rule["paramKey"]), rule["operator"], rule["value"], rule.get("valueMode", "fixed"), hv)
        for rule in rules
    )


def _first_match(row: dict, rules: list[dict]) -> dict | None:
    """該当した最初のルールを返す(表示用に、どの条件が除外/該当の根拠かを示すため)。"""
    hv = row.get("hv")
    for rule in rules:
        if _evaluate_condition(row.get(rule["paramKey"]), rule["operator"], rule["value"], rule.get("valueMode", "fixed"), hv):
            return rule
    return None


def fetch_active_groups(engine: Engine) -> list[dict]:
    groups = fetch_screening_groups_hierarchical(engine)["groups"]
    return [g for g in groups if g["isActive"]]


def fetch_ticker_tag_names(engine: Engine) -> dict[str, set[str]]:
    """銘柄ごとの保有タグ名(=候補になった根拠グループ名)を返す。"""
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_stock_tags.sql"))).mappings().all()
    result: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        result[row["ticker_symbol"]].add(row["name"])
    return result


def resolve_group(tag_names: set[str], groups: list[dict]) -> dict | None:
    by_name = {g["name"]: g for g in groups}
    matched = [by_name[name] for name in tag_names if name in by_name]
    if matched:
        return min(matched, key=lambda g: g["groupId"])
    defaults = [g for g in groups if g["isDefault"]]
    if defaults:
        return min(defaults, key=lambda g: g["groupId"])
    return None


def evaluate_entry(row: dict, group: dict | None) -> dict:
    if group is None:
        return {
            "signal_count": 0,
            "signal_total": 0,
            "signal_count_threshold": None,
            "is_strong_candidate": False,
            "is_excluded": False,
            "excluded_param_key": None,
            "loss_cut_risk_at_entry": None,
            "loss_cut_risk_param_key": None,
            "judgment_group_name": None,
        }
    entry_rules = group["rules"].get("entry_timing", {})
    c_rules = entry_rules.get("C", [])
    count = _count_matches(row, c_rules)
    threshold = group.get("signalCountThreshold")
    # 分類A(除外条件): シグナル数の条件をすべて満たしていても、これに該当する場合は
    # 有力候補としない(例: スコア不足・過熱・単日急騰・上抜け直後などの足切り)。
    excluded_rule = _first_match(row, entry_rules.get("A", []))

    # 購入直後に損切り対象にならないかの先読みチェック(同グループのloss_cut基準をそのまま
    # 流用)。rowには購入価格・購入時スコアが存在しないため、それらに依存する条件
    # (drawdown_percent・score_diffなど)は自動的に不成立となり、銘柄自体の状態を示す
    # 条件(上場廃止リスク・監理銘柄・営業利益/EPS成長率の悪化など)だけが働く。
    loss_cut_rules = group["rules"].get("loss_cut", {})
    loss_cut_a_match = _first_match(row, loss_cut_rules.get("A", []))
    loss_cut_b_match = None if loss_cut_a_match else _first_match(row, loss_cut_rules.get("B", []))
    loss_cut_match = loss_cut_a_match or loss_cut_b_match
    loss_cut_risk_at_entry = "A" if loss_cut_a_match else ("B" if loss_cut_b_match else None)

    # 損切り分類A相当(即時売却級)は買入タイミングの分類A除外と同じ強さで候補から除外する。
    # 分類B相当(回避・撤退検討級)は除外せず、警告としてのみ表示する。
    is_excluded = excluded_rule is not None or loss_cut_risk_at_entry == "A"

    return {
        "signal_count": count,
        "signal_total": len(c_rules),
        "signal_count_threshold": threshold,
        "is_strong_candidate": not is_excluded and threshold is not None and count >= threshold,
        "is_excluded": is_excluded,
        "excluded_param_key": excluded_rule["paramKey"] if excluded_rule else None,
        "loss_cut_risk_at_entry": loss_cut_risk_at_entry,
        "loss_cut_risk_param_key": loss_cut_match["paramKey"] if loss_cut_match else None,
        "ma25_deviation_percent": row.get("ma25_deviation_percent"),
        "daily_change_percent": row.get("daily_change_percent"),
        "judgment_group_name": group["name"],
    }


def evaluate_loss_cut(row: dict, group: dict | None) -> dict:
    if group is None:
        return {"priority": None, "judgment_group_name": None}
    loss_cut_rules = group["rules"].get("loss_cut", {})
    if _any_matches(row, loss_cut_rules.get("A", [])):
        priority = "A"
    elif _any_matches(row, loss_cut_rules.get("B", [])):
        priority = "B"
    else:
        priority = None
    return {"priority": priority, "judgment_group_name": group["name"]}


def evaluate_profit_taking(row: dict, group: dict | None) -> dict:
    result = {
        "achievement_percent": row.get("achievement_percent"),
        "effective_target_price": row.get("effective_target_price"),
        "effective_target_price_logic": row.get("effective_target_price_logic"),
    }
    if group is None:
        return {**result, "should_take_profit": False, "judgment_group_name": None}
    return {
        **result,
        "should_take_profit": _any_matches(row, group["rules"].get("profit_taking", {}).get("A", [])),
        "judgment_group_name": group["name"],
    }


def evaluate_holding_period_exit(purchase_date: datetime | date | None, group: dict | None) -> dict:
    """保有期間満了による強制決済(損切り・利確とは別の第3の判定軸)。

    損益に関わらず機械的に決済する規律ルールのため、profit_takingの純損益ゲートの
    対象外として扱う(呼び出し側でshould_take_profitとは独立に判定に使うこと)。
    """
    threshold_days = group.get("holdingPeriodExitDays") if group else None
    if threshold_days is None or purchase_date is None:
        return {"holding_days": None, "holding_period_exit_days": threshold_days, "is_holding_period_exceeded": False}

    purchased_on = purchase_date.date() if isinstance(purchase_date, datetime) else purchase_date
    today_jst = datetime.now(JST).date()
    holding_days = (today_jst - purchased_on).days
    return {
        "holding_days": holding_days,
        "holding_period_exit_days": threshold_days,
        "is_holding_period_exceeded": holding_days >= threshold_days,
    }


def build_entry_row(row: dict) -> dict:
    current_price = row.get("current_price")
    ma25 = row.get("ma25")
    is_above_ma25 = None if current_price is None or ma25 is None else current_price > ma25
    # MA25乖離率: 「上抜けたか否か」だけでなく、どれだけ乖離しているか(追いかけすぎ検知用)。
    ma25_deviation_percent = None if current_price is None or not ma25 else (current_price - ma25) / ma25 * 100
    # 前日比騰落率: 単日で急騰した銘柄(材料出尽くし・反落リスク)を検知するため。
    previous_close = row.get("previous_close")
    daily_change_percent = (
        None if current_price is None or not previous_close else (current_price - previous_close) / previous_close * 100
    )
    return {
        "is_above_ma25": is_above_ma25,
        "volume_ratio": row.get("volume_ratio"),
        "earnings_surprise_percent": row.get("earnings_surprise_percent"),
        "hv": row.get("hv"),
        "screening_score": row.get("screening_score"),
        "rsi": row.get("rsi"),
        "ma25_deviation_percent": ma25_deviation_percent,
        "daily_change_percent": daily_change_percent,
        "ma25_above_streak_days": row.get("ma25_above_streak_days"),
        # 購入直後の損切りリスク先読みチェック用(evaluate_entryがloss_cut分類A/Bを評価する際に使う)。
        "is_delisting_risk": row.get("is_delisting_risk"),
        "is_under_supervision": row.get("is_under_supervision"),
        "operating_profit_yoy": row.get("operating_profit_yoy"),
        "eps_growth": row.get("eps_growth"),
    }


def build_loss_cut_row(row: dict) -> dict:
    current_price = row.get("current_price")
    purchase_price = row.get("purchase_price")
    drawdown_percent = (
        None
        if current_price is None or not purchase_price
        else (current_price - purchase_price) / purchase_price * 100
    )
    current_score = row.get("current_score")
    purchase_score = row.get("purchase_score")
    score_diff = None if current_score is None or purchase_score is None else current_score - purchase_score
    return {
        "is_delisting_risk": row.get("is_delisting_risk"),
        "is_under_supervision": row.get("is_under_supervision"),
        "drawdown_percent": drawdown_percent,
        "operating_profit_yoy": row.get("operating_profit_yoy"),
        "eps_growth": row.get("eps_growth"),
        "score_diff": score_diff,
        "hv": row.get("hv"),
    }


def build_profit_taking_row(row: dict, trailing_stop_trigger_price: float | None) -> dict:
    current_price = row.get("current_price")
    purchase_price = row.get("purchase_price")
    # 手動設定値 > 購入時点スナップショット(株価変動で動かない) > 現在値ベースの自動算出値、の優先順。
    if row.get("target_price_manual") is not None:
        target = row.get("target_price_manual")
        target_logic = "manual"
    elif row.get("target_price_at_purchase") is not None:
        target = row.get("target_price_at_purchase")
        target_logic = row.get("target_price_at_purchase_logic")
    else:
        target = row.get("target_price_auto")
        target_logic = row.get("target_price_auto_logic")
    # 目標価格が購入価格を上回っていない場合、その目標には「利益確定」の意味がない
    # (下落局面でtarget_price_autoも一緒に下がり、達成率が実態と無関係に押し上げられる
    # のを防ぐ)。この場合は達成度を算出不能として扱う。
    target_is_valid = target is not None and (purchase_price is None or target > purchase_price)
    effective_target_price = target if target_is_valid else None
    effective_target_price_logic = target_logic if target_is_valid else None
    achievement_percent = (
        None if current_price is None or not effective_target_price else current_price / effective_target_price * 100
    )
    is_trailing_stop_triggered = (
        None if current_price is None or trailing_stop_trigger_price is None else current_price <= trailing_stop_trigger_price
    )
    ma25 = row.get("ma25")
    # トレンド反転(MA25割れ)による手仕舞いシグナル(①テクニカルな反転で手仕舞い)。
    is_below_ma25 = None if current_price is None or ma25 is None else current_price < ma25
    return {
        "achievement_percent": achievement_percent,
        "effective_target_price": effective_target_price,
        "effective_target_price_logic": effective_target_price_logic,
        "forward_per": row.get("forward_per"),
        "is_trailing_stop_triggered": is_trailing_stop_triggered,
        "is_below_ma25": is_below_ma25,
        "hv": row.get("hv"),
    }
