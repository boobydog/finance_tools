// DB設計(mysql/init/*.sql)に基づく型定義。

export interface Stock {
  tickerSymbol: string;
  name: string;
  marketSegment: string | null;
  sector: string | null;
  isUnderSupervision: boolean;
  isDelistingRisk: boolean;
}

// user_stock_status.status は現状 DB enum('interested','holding','sold') のみ。
// "excluded"(除外)はUI要件で追加されたがDB側は未対応のため、
// バックエンド接続時にはALTER TABLEでのenum拡張が必要。
export type StockStatus = "interested" | "holding" | "sold" | "excluded" | null;

// ターゲットプライスの算出ロジック。eps_growth: EPS成長率ベース、
// pbr_normalization: PBR正常化(BPS基準)、analyst_consensus: アナリスト目標株価平均。
export type TargetPriceLogic = "eps_growth" | "pbr_normalization" | "analyst_consensus";
export type EffectiveTargetPriceLogic = "manual" | TargetPriceLogic;

export interface StockWithStatus extends Stock {
  status: StockStatus;
  tags: Tag[];
  latestClose: number | null;
  changePercent: number | null;
  screeningScore: number | null;
  purchaseScore: number | null;
  targetPriceAuto: number | null;
  targetPriceManual: number | null;
  // 購入時点で算出し固定したターゲットプライス(以降、現在値の変動につれて動かない)。
  targetPriceAtPurchase: number | null;
  targetPriceAutoLogic: TargetPriceLogic | null;
  targetPriceAtPurchaseLogic: TargetPriceLogic | null;
}

export interface PricePoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number;
}

export type PriceHistoryInterval = "daily" | "weekly" | "monthly";

export interface LiveQuote {
  tickerSymbol: string;
  open: number | null;
  currentPrice: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  changePercent: number | null;
  isMarketOpen: boolean;
}

export interface BatchLog {
  logId: number;
  processName: string;
  status: "SUCCESS" | "FAILED" | "RUNNING" | "RETRYING";
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketIndicator {
  date: string;
  fxUsdJpy: number | null;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  relatedTickerSymbols: string[];
}

export type ScreeningCategory = "A" | "B" | "C";
export type RuleOperator = "gte" | "lte" | "eq";
// candidate: 候補スクリーニング(自動候補化)。entryTiming/lossCut/profitTaking: 買入タイミング/損切り/利確判定。
export type RulePurpose = "candidate" | "entry_timing" | "loss_cut" | "profit_taking";
// fixed: paramValueをそのまま閾値として使う。hv_multiplier: 銘柄自身のHV(ヒストリカル
// ボラティリティ)に対する倍率として使う(実際の閾値 = paramValue × その銘柄のHV)。
export type RuleValueMode = "fixed" | "hv_multiplier";

export interface ScreeningRule {
  ruleId: number;
  rulePurpose: RulePurpose;
  category: ScreeningCategory;
  paramKey: string;
  operator: RuleOperator;
  valueMode: RuleValueMode;
  paramValue: number | null;
}

export interface ScreeningGroup {
  groupId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  // 削除不可のフォールバックグループか(グループタグが一致しない銘柄に使われる)。
  isDefault: boolean;
  // 候補スクリーニング部分のみの有効/無効(isActiveとは別軸)。主にデフォルトグループで使う。
  candidateScreeningActive: boolean;
  // 買入タイミング(entry_timing)の分類C条件のうち、何件満たせば有力候補とするかの閾値。
  signalCountThreshold: number | null;
  rules: ScreeningRule[];
}

export interface ScreeningParamDefinition {
  paramKey: string;
  label: string;
  valueType: "number" | "string" | "boolean";
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  description: string | null;
}

export interface UpsertScreeningGroupRequest {
  name: string;
  description: string | null;
  signalCountThreshold?: number | null;
}

export interface CreateScreeningRuleRequest {
  rulePurpose: RulePurpose;
  category: ScreeningCategory;
  paramKey: string;
  operator: RuleOperator;
  valueMode: RuleValueMode;
  paramValue: number | null;
}

// バッチが読み込むJSON(A/B/C階層)。エクスポート/インポートの両方で使う。
export interface ScreeningRuleExport {
  paramKey: string;
  operator: RuleOperator;
  valueMode: RuleValueMode;
  value: number | null;
}

export interface ScreeningGroupExport {
  groupId?: number | null;
  name: string;
  description: string | null;
  isActive: boolean;
  rules: Record<ScreeningCategory, ScreeningRuleExport[]>;
}

export interface ScreeningRulesExport {
  generatedAt: string;
  groups: ScreeningGroupExport[];
}

export interface Tag {
  tagId: number;
  name: string;
  color: string;
}

export interface EntrySignal {
  tickerSymbol: string;
  name: string;
  sector: string | null;
  currentPrice: number | null;
  previousClose: number | null;
  ma25: number | null;
  // 直近何営業日連続でMA25を上回っているか(単日だけの急騰と定着したトレンドを区別する)。
  ma25AboveStreakDays: number | null;
  volumeRatio: number | null;
  earningsSurprisePercent: number | null;
  rsi: number | null;
  hv: number | null;
  screeningScore: number | null;
  // 以下はサーバー側(trade_judgment_engine)でグループ別ルールに基づき評価済みの値。
  signalCount: number;
  // 該当グループの買入タイミング(分類C)ルールの総数(signalCountの分母)。
  signalTotal: number;
  signalCountThreshold: number | null;
  isStrongCandidate: boolean;
  // 分類Aの除外条件(足切り)に該当したか。該当する場合、シグナル数がしきい値以上でも
  // 有力候補にはならない。
  isExcluded: boolean;
  excludedParamKey: string | null;
  ma25DeviationPercent: number | null;
  dailyChangePercent: number | null;
  judgmentGroupName: string | null;
}

export interface LossCutSignal {
  tickerSymbol: string;
  name: string;
  sector: string | null;
  isUnderSupervision: boolean;
  isDelistingRisk: boolean;
  purchaseScore: number | null;
  currentScore: number | null;
  currentPrice: number | null;
  purchasePrice: number | null;
  operatingProfitYoy: number | null;
  epsGrowth: number | null;
  // ヒストリカル・ボラティリティ(年率換算,%)。損切りライン(drawdown_percent)が
  // hv_multiplierモードの場合、実際の閾値 = 該当ルールの倍率 × このHV。
  hv: number | null;
  priority: "A" | "B" | null;
  judgmentGroupName: string | null;
}

export interface ProfitTakingSignal {
  tickerSymbol: string;
  name: string;
  sector: string | null;
  currentPrice: number | null;
  targetPriceAuto: number | null;
  targetPriceManual: number | null;
  targetPriceAtPurchase: number | null;
  targetPriceAutoLogic: TargetPriceLogic | null;
  targetPriceAtPurchaseLogic: TargetPriceLogic | null;
  purchasePrice: number | null;
  highestPriceSincePurchase: number | null;
  forwardPer: number | null;
  hv: number | null;
  trailingStopTriggerPrice: number | null;
  // サーバー側(trade_judgment_engine)で評価済みの、実際に使われた目標価格と達成度。
  // 目標価格が購入価格を上回っていない場合はnull(下落局面で目標も一緒に下がり、
  // 達成率が実態と無関係に押し上げられるのを防ぐための無効化)。
  effectiveTargetPrice: number | null;
  effectiveTargetPriceLogic: EffectiveTargetPriceLogic | null;
  achievementPercent: number | null;
  shouldTakeProfit: boolean;
  judgmentGroupName: string | null;
}

export interface TechnicalScoreThreshold {
  threshold: number;
}

export interface TradeHistoryEntry {
  tradeId: number;
  tickerSymbol: string;
  action: "buy" | "sell";
  price: number;
  quantity: number;
  tradedAt: string;
  screeningGroupId: number | null;
  screeningGroupName: string | null;
  memo: string | null;
}

export interface CreateTradeRequest {
  action: "buy" | "sell";
  price: number;
  quantity: number;
  screeningGroupId: number | null;
  memo: string | null;
}
