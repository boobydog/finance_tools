"""UIとMySQLを繋ぐREST API。

既存のbatch/scripts資産(db.py, sql_runner.py)をそのまま再利用し、
DBアクセスはSQLファイル(batch/sql/*.sql)経由で行う。
"""

import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from api.schemas import (
    BatchLog,
    CreateScreeningRuleRequest,
    CreateTradeRequest,
    EntrySignal,
    LiveQuote,
    LossCutSignal,
    MarketIndicator,
    PricePoint,
    ProfitTakingSignal,
    ScreeningGroup,
    ScreeningParamDefinition,
    ScreeningRule,
    ScreeningRulesExport,
    Stock,
    Tag,
    TechnicalScoreThreshold,
    TradeHistoryEntry,
    UpdateScreeningGroupActiveRequest,
    UpdateScreeningGroupCandidateActiveRequest,
    UpdateStockStatusRequest,
    UpdateTargetPriceRequest,
    UpsertScreeningGroupRequest,
)
from scripts.app_settings import (
    TECHNICAL_SCORE_CANDIDATE_THRESHOLD_KEY,
    get_technical_score_candidate_threshold,
    get_trailing_stop_allowance_percent,
    set_setting,
)
from scripts.db import get_engine
from scripts.live_quote import fetch_cached_quote, fetch_cached_quotes, fetch_live_quote, fetch_live_quotes
from scripts.market_hours import is_tse_open
from scripts.pipeline import refresh_metrics_and_screening
from scripts.price_history import aggregate_price_history
from scripts.screening_config import (
    export_screening_rules_json,
    fetch_param_definitions,
    replace_screening_rules_from_data,
)
from scripts.sql_runner import load_sql
from scripts.target_price import snapshot_target_price_at_purchase
from scripts.trade_judgment_engine import (
    build_entry_row,
    build_loss_cut_row,
    build_profit_taking_row,
    evaluate_entry,
    evaluate_loss_cut,
    evaluate_profit_taking,
    fetch_active_groups,
    fetch_ticker_tag_names,
    resolve_group,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = FastAPI(title="finance_tools API")

SCREENING_RULES_JSON_PATH = os.environ.get(
    "SCREENING_RULES_JSON_PATH", "./data/screening/screening_rules.json"
)

_allowed_origins = os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _fetch_stock_tags() -> dict[str, list[Tag]]:
    with get_engine().connect() as conn:
        rows = conn.execute(text(load_sql("select_stock_tags.sql"))).mappings().all()
    tags_by_ticker: dict[str, list[Tag]] = defaultdict(list)
    for row in rows:
        tags_by_ticker[row["ticker_symbol"]].append(
            Tag(tag_id=row["tag_id"], name=row["name"], color=row["color"])
        )
    return tags_by_ticker


def _change_percent(latest_close, previous_close) -> float | None:
    if latest_close is None or previous_close is None or previous_close == 0:
        return None
    return round(float(latest_close - previous_close) / float(previous_close) * 100, 2)


@app.get("/api/stocks", response_model=list[Stock])
def list_stocks(background_tasks: BackgroundTasks) -> list[Stock]:
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    with get_engine().connect() as conn:
        rows = conn.execute(text(load_sql("select_stocks_with_status.sql"))).mappings().all()
    tags_by_ticker = _fetch_stock_tags()
    return [
        Stock(
            ticker_symbol=row["ticker_symbol"],
            name=row["name"],
            market_segment=row["market_segment"],
            sector=row["sector"],
            is_under_supervision=bool(row["is_under_supervision"]),
            is_delisting_risk=bool(row["is_delisting_risk"]),
            status=row["status"],
            tags=tags_by_ticker.get(row["ticker_symbol"], []),
            screening_score=row["screening_score"],
            purchase_score=row["purchase_score"],
            target_price_auto=row["target_price_auto"],
            target_price_manual=row["target_price_manual"],
            target_price_at_purchase=row["target_price_at_purchase"],
            target_price_auto_logic=row["target_price_auto_logic"],
            target_price_at_purchase_logic=row["target_price_at_purchase_logic"],
            latest_close=float(row["latest_close"]) if row["latest_close"] is not None else None,
            change_percent=_change_percent(row["latest_close"], row["previous_close"]),
        )
        for row in rows
    ]


@app.get("/api/stocks/{ticker_symbol}", response_model=Stock)
def get_stock(ticker_symbol: str) -> Stock:
    with get_engine().connect() as conn:
        row = conn.execute(
            text(load_sql("select_stock_by_ticker.sql")), {"ticker_symbol": ticker_symbol}
        ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    tags_by_ticker = _fetch_stock_tags()
    return Stock(
        ticker_symbol=row["ticker_symbol"],
        name=row["name"],
        market_segment=row["market_segment"],
        sector=row["sector"],
        is_under_supervision=bool(row["is_under_supervision"]),
        is_delisting_risk=bool(row["is_delisting_risk"]),
        status=row["status"],
        tags=tags_by_ticker.get(ticker_symbol, []),
        screening_score=row["screening_score"],
        purchase_score=row["purchase_score"],
        target_price_auto=row["target_price_auto"],
        target_price_manual=row["target_price_manual"],
        target_price_at_purchase=row["target_price_at_purchase"],
        target_price_auto_logic=row["target_price_auto_logic"],
        target_price_at_purchase_logic=row["target_price_at_purchase_logic"],
        latest_close=float(row["latest_close"]) if row["latest_close"] is not None else None,
        change_percent=_change_percent(row["latest_close"], row["previous_close"]),
    )


@app.put("/api/stocks/{ticker_symbol}/status", response_model=Stock)
def update_stock_status(ticker_symbol: str, body: UpdateStockStatusRequest) -> Stock:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("upsert_user_stock_status.sql")),
            {"ticker_symbol": ticker_symbol, "status": body.status},
        )
    return get_stock(ticker_symbol)


@app.put("/api/stocks/{ticker_symbol}/target-price", response_model=Stock)
def update_target_price(ticker_symbol: str, body: UpdateTargetPriceRequest) -> Stock:
    """ターゲットプライスの手動上書き値を設定・変更する。nullを渡すとリセット(自動算出値に戻る)。"""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(load_sql("update_target_price_manual.sql")),
            {"ticker_symbol": ticker_symbol, "target_price_manual": body.target_price_manual},
        )
    return get_stock(ticker_symbol)


_TRADE_ACTION_TO_STATUS = {"buy": "holding", "sell": "sold"}


@app.post("/api/stocks/{ticker_symbol}/trades", response_model=Stock)
def create_trade(ticker_symbol: str, body: CreateTradeRequest) -> Stock:
    """売買を記録し、根拠(スクリーニンググループ・メモ)をtrade_historyへ保存した上で
    ステータスを連動して更新する(購入->保有中、売却->売却済)。
    """
    traded_at = body.traded_at or datetime.now(timezone.utc)
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("insert_trade_history.sql")),
            {
                "ticker_symbol": ticker_symbol,
                "action": body.action,
                "price": body.price,
                "quantity": body.quantity,
                "traded_at": traded_at,
                "screening_group_id": body.screening_group_id,
                "memo": body.memo,
            },
        )
        if body.action == "buy":
            score_row = conn.execute(
                text(load_sql("select_technical_score.sql")), {"ticker_symbol": ticker_symbol}
            ).mappings().first()
            conn.execute(
                text(load_sql("upsert_user_stock_status_with_purchase_score.sql")),
                {
                    "ticker_symbol": ticker_symbol,
                    "status": _TRADE_ACTION_TO_STATUS[body.action],
                    "purchase_score": score_row["total_score"] if score_row else None,
                    "purchase_price": body.price,
                },
            )
        else:
            conn.execute(
                text(load_sql("upsert_user_stock_status.sql")),
                {"ticker_symbol": ticker_symbol, "status": _TRADE_ACTION_TO_STATUS[body.action]},
            )

    if body.action == "buy":
        snapshot_target_price_at_purchase(get_engine(), ticker_symbol, body.price)

    return get_stock(ticker_symbol)


@app.get("/api/stocks/{ticker_symbol}/price-history", response_model=list[PricePoint])
def get_price_history(
    ticker_symbol: str, interval: Literal["daily", "weekly", "monthly"] = "daily"
) -> list[PricePoint]:
    with get_engine().connect() as conn:
        rows = conn.execute(
            text(load_sql("select_price_history.sql")), {"ticker_symbol": ticker_symbol}
        ).mappings().all()
    aggregated = aggregate_price_history([dict(row) for row in rows], interval)
    return [
        PricePoint(
            date=row["date"],
            open=float(row["open_price"]) if row["open_price"] is not None else None,
            high=float(row["high_price"]) if row["high_price"] is not None else None,
            low=float(row["low_price"]) if row["low_price"] is not None else None,
            close=float(row["close_price"]),
            volume=row["volume"],
        )
        for row in aggregated
    ]


def _build_live_quote(ticker_symbol: str, quote: dict, market_open: bool) -> LiveQuote:
    change_percent = None
    if quote["current_price"] is not None and quote["previous_close"]:
        change_percent = round(
            (quote["current_price"] - quote["previous_close"]) / quote["previous_close"] * 100, 2
        )
    return LiveQuote(ticker_symbol=ticker_symbol, change_percent=change_percent, is_market_open=market_open, **quote)


@app.get("/api/stocks/{ticker_symbol}/live-quote", response_model=LiveQuote)
def get_live_quote(ticker_symbol: str) -> LiveQuote:
    """銘柄詳細画面向け: 取引時間中はyfinanceからほぼリアルタイムの株価を取得する(DB保存なし)。
    取引時間外は株価が動かないためyfinanceを呼ばず、日次キャッシュの値を返す。
    """
    market_open = is_tse_open()
    quote = fetch_live_quote(ticker_symbol) if market_open else fetch_cached_quote(get_engine(), ticker_symbol)
    if quote is None:
        raise HTTPException(status_code=502, detail="Failed to fetch live quote")
    return _build_live_quote(ticker_symbol, quote, market_open)


@app.get("/api/live-quotes", response_model=list[LiveQuote])
def list_live_quotes(symbols: str) -> list[LiveQuote]:
    """銘柄管理一覧向け: 画面表示中の銘柄(最大MAX_BULK_SYMBOLS件)の株価をまとめて取得する。
    取引時間外はyfinanceを呼ばず、日次キャッシュからまとめて返す。
    """
    ticker_symbols = [s for s in symbols.split(",") if s]
    market_open = is_tse_open()
    quotes = (
        fetch_live_quotes(ticker_symbols) if market_open else fetch_cached_quotes(get_engine(), ticker_symbols)
    )
    return [
        _build_live_quote(ticker_symbol, quote, market_open)
        for ticker_symbol, quote in quotes.items()
        if quote is not None
    ]


@app.get("/api/entry-signals", response_model=list[EntrySignal])
def list_entry_signals() -> list[EntrySignal]:
    """買入タイミング判定画面向け: 候補(interested)銘柄のエントリーシグナルを返す。

    銘柄が持つタグ(候補になった根拠グループ名)に一致するスクリーニンググループの
    買入タイミング基準で評価し、なければデフォルトグループの基準にフォールバックする。
    """
    engine = get_engine()
    groups = fetch_active_groups(engine)
    tag_names_by_ticker = fetch_ticker_tag_names(engine)
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_entry_candidates.sql"))).mappings().all()

    result = []
    for row in rows:
        row = dict(row)
        group = resolve_group(tag_names_by_ticker.get(row["ticker_symbol"], set()), groups)
        verdict = evaluate_entry(build_entry_row(row), group)
        result.append(EntrySignal(**row, **verdict))
    return result


@app.get("/api/loss-cut-signals", response_model=list[LossCutSignal])
def list_loss_cut_signals() -> list[LossCutSignal]:
    """損切り判定画面向け: 保有中(holding)銘柄のリスク・評価低下シグナルを返す。

    銘柄が持つタグ(候補になった根拠グループ名)に一致するスクリーニンググループの
    損切り基準で評価し、なければデフォルトグループの基準にフォールバックする。
    """
    engine = get_engine()
    groups = fetch_active_groups(engine)
    tag_names_by_ticker = fetch_ticker_tag_names(engine)
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_loss_cut_candidates.sql"))).mappings().all()

    result = []
    for row in rows:
        row = dict(row)
        group = resolve_group(tag_names_by_ticker.get(row["ticker_symbol"], set()), groups)
        verdict = evaluate_loss_cut(build_loss_cut_row(row), group)
        result.append(LossCutSignal(**row, **verdict))
    return result


@app.get("/api/profit-taking-signals", response_model=list[ProfitTakingSignal])
def list_profit_taking_signals() -> list[ProfitTakingSignal]:
    """利確判定画面向け: 保有中(holding)銘柄の目標達成度・過熱感・トレイリングストップを返す。

    銘柄が持つタグ(候補になった根拠グループ名)に一致するスクリーニンググループの
    利確基準で評価し、なければデフォルトグループの基準にフォールバックする。
    """
    engine = get_engine()
    allowance_percent = get_trailing_stop_allowance_percent(engine)
    groups = fetch_active_groups(engine)
    tag_names_by_ticker = fetch_ticker_tag_names(engine)
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_profit_taking_candidates.sql"))).mappings().all()

    result = []
    for row in rows:
        row = dict(row)
        trailing_stop_trigger_price = (
            float(row["highest_price_since_purchase"]) * (1 - allowance_percent / 100)
            if row["highest_price_since_purchase"] is not None
            else None
        )
        group = resolve_group(tag_names_by_ticker.get(row["ticker_symbol"], set()), groups)
        verdict = evaluate_profit_taking(build_profit_taking_row(row, trailing_stop_trigger_price), group)
        result.append(
            ProfitTakingSignal(
                **row,
                trailing_stop_trigger_price=trailing_stop_trigger_price,
                **verdict,
            )
        )
    return result


@app.get("/api/batch-logs", response_model=list[BatchLog])
def list_batch_logs() -> list[BatchLog]:
    with get_engine().connect() as conn:
        rows = conn.execute(text(load_sql("select_batch_logs.sql"))).mappings().all()
    return [BatchLog(**row) for row in rows]


@app.get("/api/market-indicators", response_model=list[MarketIndicator])
def list_market_indicators() -> list[MarketIndicator]:
    with get_engine().connect() as conn:
        rows = conn.execute(text(load_sql("select_market_indicators.sql"))).mappings().all()
    return [
        MarketIndicator(date=row["date"], fx_usd_jpy=row["fx_usd_jpy"]) for row in rows
    ]


@app.get("/api/tags", response_model=list[Tag])
def list_tags() -> list[Tag]:
    with get_engine().connect() as conn:
        rows = conn.execute(text(load_sql("select_tags.sql"))).mappings().all()
    return [Tag(**row) for row in rows]


@app.get("/api/settings/technical-score-threshold", response_model=TechnicalScoreThreshold)
def get_technical_score_threshold() -> TechnicalScoreThreshold:
    return TechnicalScoreThreshold(threshold=get_technical_score_candidate_threshold(get_engine()))


@app.put("/api/settings/technical-score-threshold", response_model=TechnicalScoreThreshold)
def update_technical_score_threshold(
    body: TechnicalScoreThreshold, background_tasks: BackgroundTasks
) -> TechnicalScoreThreshold:
    """テクニカルスコアによる自動候補化のしきい値を更新する。

    変更後は自動パイプラインを再実行し、古いしきい値のタグ・候補ステータスを
    (reconcile_stale_score_tags経由で)最新のしきい値に合わせて整理する。
    """
    engine = get_engine()
    set_setting(engine, TECHNICAL_SCORE_CANDIDATE_THRESHOLD_KEY, body.threshold)
    background_tasks.add_task(refresh_metrics_and_screening, engine)
    return TechnicalScoreThreshold(threshold=body.threshold)


def _fetch_screening_groups() -> list[ScreeningGroup]:
    with get_engine().connect() as conn:
        group_rows = conn.execute(text(load_sql("select_screening_groups.sql"))).mappings().all()
        rule_rows = conn.execute(text(load_sql("select_screening_rules.sql"))).mappings().all()

    rules_by_group: dict[int, list[ScreeningRule]] = defaultdict(list)
    for row in rule_rows:
        rules_by_group[row["group_id"]].append(
            ScreeningRule(
                rule_id=row["rule_id"],
                rule_purpose=row["rule_purpose"],
                category=row["category"],
                param_key=row["param_key"],
                operator=row["operator"],
                value_mode=row["value_mode"],
                param_value=row["min_threshold"],
            )
        )

    return [
        ScreeningGroup(
            group_id=row["group_id"],
            name=row["name"],
            description=row["description"],
            is_active=bool(row["is_active"]),
            is_default=bool(row["is_default"]),
            candidate_screening_active=bool(row["candidate_screening_active"]),
            signal_count_threshold=row["signal_count_threshold"],
            rules=rules_by_group.get(row["group_id"], []),
        )
        for row in group_rows
    ]


def _sync_screening_rules_json() -> dict:
    """screening_groups/rulesの変更後に、共有JSONを最新化する。"""
    return export_screening_rules_json(get_engine(), SCREENING_RULES_JSON_PATH)


@app.get("/api/screening-groups", response_model=list[ScreeningGroup])
def list_screening_groups() -> list[ScreeningGroup]:
    return _fetch_screening_groups()


@app.post("/api/screening-groups", response_model=list[ScreeningGroup])
def create_screening_group(body: UpsertScreeningGroupRequest, background_tasks: BackgroundTasks) -> list[ScreeningGroup]:
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("insert_screening_group.sql")),
            {"name": body.name, "description": body.description, "is_active": True},
        )
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.put("/api/screening-groups/{group_id}/active", response_model=list[ScreeningGroup])
def update_screening_group_active(
    group_id: int, body: UpdateScreeningGroupActiveRequest, background_tasks: BackgroundTasks
) -> list[ScreeningGroup]:
    """グループ単位で判定エンジンの対象から一時的に外す(削除せず無効化する)。"""
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("update_screening_group_active.sql")),
            {"group_id": group_id, "is_active": body.is_active},
        )
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.put("/api/screening-groups/{group_id}", response_model=list[ScreeningGroup])
def update_screening_group(
    group_id: int, body: UpsertScreeningGroupRequest, background_tasks: BackgroundTasks
) -> list[ScreeningGroup]:
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("update_screening_group.sql")),
            {
                "group_id": group_id,
                "name": body.name,
                "description": body.description,
                "signal_count_threshold": body.signal_count_threshold,
            },
        )
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.put("/api/screening-groups/{group_id}/candidate-active", response_model=list[ScreeningGroup])
def update_screening_group_candidate_active(
    group_id: int, body: UpdateScreeningGroupCandidateActiveRequest, background_tasks: BackgroundTasks
) -> list[ScreeningGroup]:
    """候補スクリーニング部分のみを個別に有効/無効化する(主にデフォルトグループ向け)。"""
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("update_screening_group_candidate_active.sql")),
            {"group_id": group_id, "candidate_screening_active": body.candidate_screening_active},
        )
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.delete("/api/screening-groups/{group_id}", response_model=list[ScreeningGroup])
def delete_screening_group(group_id: int, background_tasks: BackgroundTasks) -> list[ScreeningGroup]:
    groups = _fetch_screening_groups()
    target = next((g for g in groups if g.group_id == group_id), None)
    if target is not None and target.is_default:
        raise HTTPException(status_code=400, detail="デフォルトグループは削除できません")
    with get_engine().begin() as conn:
        conn.execute(text(load_sql("delete_screening_rules_by_group.sql")), {"group_id": group_id})
        conn.execute(text(load_sql("delete_screening_group.sql")), {"group_id": group_id})
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.post("/api/screening-groups/{group_id}/rules", response_model=list[ScreeningGroup])
def create_screening_rule(
    group_id: int, body: CreateScreeningRuleRequest, background_tasks: BackgroundTasks
) -> list[ScreeningGroup]:
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("insert_screening_rule.sql")),
            {
                "group_id": group_id,
                "rule_purpose": body.rule_purpose,
                "category": body.category,
                "param_key": body.param_key,
                "operator": body.operator,
                "value_mode": body.value_mode,
                "param_value": body.param_value,
            },
        )
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.put("/api/screening-rules/{rule_id}", response_model=list[ScreeningGroup])
def update_screening_rule(
    rule_id: int, body: CreateScreeningRuleRequest, background_tasks: BackgroundTasks
) -> list[ScreeningGroup]:
    with get_engine().begin() as conn:
        conn.execute(
            text(load_sql("update_screening_rule.sql")),
            {
                "rule_id": rule_id,
                "rule_purpose": body.rule_purpose,
                "category": body.category,
                "param_key": body.param_key,
                "operator": body.operator,
                "value_mode": body.value_mode,
                "param_value": body.param_value,
            },
        )
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.delete("/api/screening-rules/{rule_id}", response_model=list[ScreeningGroup])
def delete_screening_rule(rule_id: int, background_tasks: BackgroundTasks) -> list[ScreeningGroup]:
    with get_engine().begin() as conn:
        conn.execute(text(load_sql("delete_screening_rule.sql")), {"rule_id": rule_id})
    _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return _fetch_screening_groups()


@app.get("/api/screening-param-definitions", response_model=list[ScreeningParamDefinition])
def list_screening_param_definitions() -> list[ScreeningParamDefinition]:
    return [ScreeningParamDefinition(**row) for row in fetch_param_definitions(get_engine())]


@app.get("/api/screening-rules/export", response_model=ScreeningRulesExport)
def export_screening_rules() -> ScreeningRulesExport:
    """現在のDBの内容をA/B/C階層のJSONとして返し、共有ボリュームにも書き出す。"""
    data = _sync_screening_rules_json()
    return ScreeningRulesExport(**data)


@app.post("/api/screening-rules/import", response_model=ScreeningRulesExport)
def import_screening_rules(body: ScreeningRulesExport, background_tasks: BackgroundTasks) -> ScreeningRulesExport:
    """アップロードされたJSON(A/B/C階層)でDBの内容を総入れ替えする。"""
    replace_screening_rules_from_data(get_engine(), body.model_dump(by_alias=True))
    data = _sync_screening_rules_json()
    background_tasks.add_task(refresh_metrics_and_screening, get_engine())
    return ScreeningRulesExport(**data)


@app.get("/api/trade-history", response_model=list[TradeHistoryEntry])
def list_trade_history(ticker_symbol: str | None = None) -> list[TradeHistoryEntry]:
    with get_engine().connect() as conn:
        if ticker_symbol:
            rows = conn.execute(
                text(load_sql("select_trade_history_by_ticker.sql")),
                {"ticker_symbol": ticker_symbol},
            ).mappings().all()
        else:
            rows = conn.execute(text(load_sql("select_trade_history.sql"))).mappings().all()
    return [TradeHistoryEntry(**row) for row in rows]
