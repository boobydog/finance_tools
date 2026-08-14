"""FastAPIのレスポンス/リクエストのPydanticモデル。

frontend/src/types/index.ts のキャメルケース表現に合わせるため、
alias_generatorでsnake_case(Python) <-> camelCase(JSON)を変換する。
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

StockStatus = Literal["interested", "holding", "sold", "excluded"]
TargetPriceLogic = Literal["eps_growth", "pbr_normalization", "analyst_consensus"]
EffectiveTargetPriceLogic = Literal["manual", "eps_growth", "pbr_normalization", "analyst_consensus"]
# taxable: 特定口座(源泉徴収あり)/一般口座。nisa: NISA口座(譲渡益非課税・手数料無料として扱う)。
# mixed: 複数回の買い増しで両方の口座種別の残存ポジションが混在している(表示専用、
# 個別の取引記録には設定できない)。
AccountType = Literal["taxable", "nisa"]
PositionAccountType = Literal["taxable", "nisa", "mixed"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Tag(CamelModel):
    tag_id: int
    name: str
    color: str | None = None


class TechnicalScoreThreshold(CamelModel):
    threshold: int


# テクニカルスコア計算式(technical_screener.py)の各要素の配点・期間・閾値。
# 設定画面(テクニカルスコア設定)で編集され、保存すると全銘柄のスコアを再計算する。
class TechnicalScoreConfig(CamelModel):
    stage2_points: int
    stage2_sma_short_period: int
    stage2_sma_long_period: int
    stage2_trend_lookback_days: int
    rs_points: int
    rs_lookback_days: int
    rs_threshold: float
    volume_points: int
    volume_average_period: int
    volume_ratio_threshold: float
    rsi_points: int
    rsi_period: int
    rsi_comfort_low: int
    rsi_comfort_high: int
    rsi_overbought_threshold: int
    rsi_overbought_penalty: int
    vcp_points: int
    vcp_high52w_ratio_threshold: float
    vcp_volatility_lookback_days: int
    vcp_atr_period: int
    vcp_history_lookback_days: int
    macd_points: int
    macd_fast_period: int
    macd_slow_period: int
    macd_signal_period: int
    benchmark_symbol: str
    history_period: str


class CapitalGainsTaxRate(CamelModel):
    rate: float


class TradingFeeTier(CamelModel):
    tier_id: int
    max_trade_value: float | None
    commission: float


class UpsertTradingFeeTierRequest(CamelModel):
    max_trade_value: float | None = None
    commission: float


class UpdateTargetPriceRequest(CamelModel):
    target_price_manual: float | None


class LiveQuote(CamelModel):
    ticker_symbol: str
    open: float | None
    current_price: float | None
    previous_close: float | None
    day_high: float | None
    day_low: float | None
    change_percent: float | None
    is_market_open: bool


class EntrySignal(CamelModel):
    ticker_symbol: str
    name: str
    sector: str | None
    current_price: float | None
    previous_close: float | None
    ma25: float | None
    ma25_above_streak_days: int | None
    volume_ratio: float | None
    earnings_surprise_percent: float | None
    rsi: float | None
    hv: float | None
    screening_score: float | None
    signal_count: int
    signal_total: int
    signal_count_threshold: int | None
    is_strong_candidate: bool
    is_excluded: bool
    # 除外(分類A)に該当した場合、根拠となったparam_key(例: rsi, ma25_deviation_percent)。
    excluded_param_key: str | None
    # 購入直後に損切り対象となる可能性(同グループのloss_cut分類A/Bを先読み評価した結果)。
    # Aは候補から除外済み(is_excludedに反映)、Bは除外はせず警告表示のみに使う。
    loss_cut_risk_at_entry: Literal["A", "B"] | None
    loss_cut_risk_param_key: str | None
    ma25_deviation_percent: float | None
    daily_change_percent: float | None
    judgment_group_name: str | None


class LossCutSignal(CamelModel):
    ticker_symbol: str
    name: str
    sector: str | None
    is_under_supervision: bool
    is_delisting_risk: bool
    purchase_score: float | None
    current_score: float | None
    current_price: float | None
    purchase_price: float | None
    operating_profit_yoy: float | None
    eps_growth: float | None
    hv: float | None
    quantity: int | None
    # 残存ポジションの口座種別(複数回の買い増しに対応、taxable/nisaが混在する場合はmixed)。
    # 以下の手数料・税引後の想定損益は口座種別ごとに計算した上で合算している
    # (NISA分は非課税・手数料無料)。
    account_type: PositionAccountType | None
    buy_commission: float | None
    sell_commission: float | None
    gross_gain: float | None
    estimated_tax: float | None
    net_profit: float | None
    priority: Literal["A", "B"] | None
    judgment_group_name: str | None


class ProfitTakingSignal(CamelModel):
    ticker_symbol: str
    name: str
    sector: str | None
    current_price: float | None
    target_price_auto: float | None
    target_price_manual: float | None
    target_price_at_purchase: float | None
    target_price_auto_logic: TargetPriceLogic | None
    target_price_at_purchase_logic: TargetPriceLogic | None
    purchase_price: float | None
    quantity: int | None
    # 残存ポジションの口座種別(複数回の買い増しに対応、taxable/nisaが混在する場合はmixed)。
    # 以下の手数料・税引後の想定損益は口座種別ごとに計算した上で合算している
    # (NISA分は非課税・手数料無料)。
    account_type: PositionAccountType | None
    highest_price_since_purchase: float | None
    forward_per: float | None
    hv: float | None
    ma25: float | None
    trailing_stop_trigger_price: float | None
    # 実際に使われた目標価格(手動 > 購入時スナップショット > 自動算出値)。
    # 目標価格が購入価格を上回っていない場合はnull(利確判定として無効)。
    effective_target_price: float | None
    effective_target_price_logic: EffectiveTargetPriceLogic | None
    achievement_percent: float | None
    # 手数料・税引後の想定損益(概算)。net_profitが黒字でない場合、should_take_profitは
    # falseに強制される(額面上は利確条件を満たしていても、実質的な利益が出ない場合は
    # 利確シグナルとして扱わない)。
    buy_commission: float | None
    sell_commission: float | None
    gross_gain: float | None
    estimated_tax: float | None
    net_profit: float | None
    should_take_profit: bool
    # 保有期間満了による強制決済(損切り・利確とは独立した第3の判定軸。純損益ゲートの対象外)。
    holding_days: int | None
    holding_period_exit_days: int | None
    is_holding_period_exceeded: bool
    judgment_group_name: str | None


class Stock(CamelModel):
    ticker_symbol: str
    name: str
    market_segment: str | None
    sector: str | None
    is_under_supervision: bool
    is_delisting_risk: bool
    status: StockStatus | None
    tags: list[Tag] = []
    latest_close: float | None = None
    change_percent: float | None = None
    screening_score: float | None = None
    purchase_score: float | None = None
    target_price_auto: float | None = None
    target_price_manual: float | None = None
    target_price_at_purchase: float | None = None
    target_price_auto_logic: TargetPriceLogic | None = None
    target_price_at_purchase_logic: TargetPriceLogic | None = None


class PricePoint(CamelModel):
    date: date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float
    volume: int


class UpdateStockStatusRequest(CamelModel):
    status: StockStatus


class BatchLog(CamelModel):
    log_id: int
    process_name: str
    status: str
    retry_count: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class MarketIndicator(CamelModel):
    date: date
    fx_usd_jpy: float | None


ScreeningCategory = Literal["A", "B", "C"]
ScreeningOperator = Literal["gte", "lte", "eq"]
RulePurpose = Literal["candidate", "entry_timing", "loss_cut", "profit_taking"]
RuleValueMode = Literal["fixed", "hv_multiplier"]


class ScreeningParamDefinition(CamelModel):
    param_key: str
    label: str
    value_type: Literal["number", "string", "boolean"]
    min_value: float | None
    max_value: float | None
    unit: str | None
    description: str | None


class ScreeningRule(CamelModel):
    rule_id: int
    rule_purpose: RulePurpose
    category: ScreeningCategory
    param_key: str | None
    operator: ScreeningOperator | None
    value_mode: RuleValueMode = "fixed"
    param_value: float | None


class ScreeningGroup(CamelModel):
    group_id: int
    name: str
    description: str | None
    is_active: bool = True
    is_default: bool = False
    candidate_screening_active: bool = True
    signal_count_threshold: int | None = None
    # 保有期間の上限(日数)。超えると損益に関わらず強制決済の対象になる(NULLは無効)。
    holding_period_exit_days: int | None = None
    rules: list[ScreeningRule] = []


class UpsertScreeningGroupRequest(CamelModel):
    name: str
    description: str | None = None
    signal_count_threshold: int | None = None
    holding_period_exit_days: int | None = None


class UpdateScreeningGroupActiveRequest(CamelModel):
    is_active: bool


class UpdateScreeningGroupCandidateActiveRequest(CamelModel):
    candidate_screening_active: bool


class CreateScreeningRuleRequest(CamelModel):
    rule_purpose: RulePurpose
    category: ScreeningCategory
    param_key: str
    operator: ScreeningOperator
    value_mode: RuleValueMode = "fixed"
    param_value: float | None = None


class ScreeningRuleExport(CamelModel):
    param_key: str
    operator: ScreeningOperator
    value_mode: RuleValueMode = "fixed"
    value: float | None = None


class ScreeningGroupExport(CamelModel):
    group_id: int | None = None
    name: str
    description: str | None = None
    is_active: bool = True
    rules: dict[ScreeningCategory, list[ScreeningRuleExport]]


class ScreeningRulesExport(CamelModel):
    generated_at: str
    groups: list[ScreeningGroupExport]


class TradeHistoryEntry(CamelModel):
    trade_id: int
    ticker_symbol: str
    action: Literal["buy", "sell"]
    price: float
    quantity: int
    traded_at: datetime
    screening_group_id: int | None
    screening_group_name: str | None
    memo: str | None
    account_type: AccountType


class CreateTradeRequest(CamelModel):
    action: Literal["buy", "sell"]
    price: float
    quantity: int
    screening_group_id: int | None = None
    memo: str | None = None
    traded_at: datetime | None = None
    account_type: AccountType = "taxable"
