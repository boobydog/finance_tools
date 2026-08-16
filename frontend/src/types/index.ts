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
export type StockStatus = "interested" | "holding" | "sold" | "excluded" | "considering" | null;

// ターゲットプライスの算出ロジック。eps_growth: EPS成長率ベース、
// pbr_normalization: PBR正常化(BPS基準)、analyst_consensus: アナリスト目標株価平均。
export type TargetPriceLogic = "eps_growth" | "pbr_normalization" | "analyst_consensus";
export type EffectiveTargetPriceLogic = "manual" | TargetPriceLogic;

// taxable: 特定口座(源泉徴収あり)/一般口座。nisa: NISA口座(譲渡益非課税・手数料無料として扱う)。
export type AccountType = "taxable" | "nisa";
// 保有ポジションの口座種別。複数回の買い増しで両方の口座種別の残存分が混在している場合はmixed
// (個別の取引記録には設定できない、表示専用の値)。
export type PositionAccountType = AccountType | "mixed";

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
  // 保有期間の上限(日数)。超えると損益に関わらず強制決済の対象になる(損切り・利確とは
  // 独立した第3の判定軸で、null は無効)。
  holdingPeriodExitDays: number | null;
  // トレイリングストップの許容下落率(%)。nullの場合は取引コスト設定の全体設定にフォールバック。
  trailingStopAllowancePercent: number | null;
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
  holdingPeriodExitDays?: number | null;
  trailingStopAllowancePercent?: number | null;
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
  // 候補(interested)だけでなく、複数回の買い増し・再エントリーの判断用に保有中(holding)・
  // 売却済(sold)銘柄も対象に含む(除外・未設定は対象外)。
  status: StockStatus;
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
  // 購入直後に損切り対象となる可能性(同グループのloss_cut分類A/Bを先読み評価した結果)。
  // AはisExcluded/isStrongCandidateに反映済み(候補から除外)、Bは除外せず警告表示のみ。
  lossCutRiskAtEntry: "A" | "B" | null;
  lossCutRiskParamKey: string | null;
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
  quantity: number | null;
  // 残存ポジションの口座種別(複数回の買い増しに対応、taxable/nisaが混在する場合はmixed)。
  // 以下の手数料・税引後の想定損益は口座種別ごとに計算した上で合算している
  // (NISA分は非課税・手数料無料)。
  accountType: PositionAccountType | null;
  buyCommission: number | null;
  sellCommission: number | null;
  grossGain: number | null;
  estimatedTax: number | null;
  netProfit: number | null;
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
  quantity: number | null;
  // 残存ポジションの口座種別(複数回の買い増しに対応、taxable/nisaが混在する場合はmixed)。
  // 以下の手数料・税引後の想定損益は口座種別ごとに計算した上で合算している
  // (NISA分は非課税・手数料無料)。
  accountType: PositionAccountType | null;
  highestPriceSincePurchase: number | null;
  forwardPer: number | null;
  hv: number | null;
  ma25: number | null;
  trailingStopTriggerPrice: number | null;
  // サーバー側(trade_judgment_engine)で評価済みの、実際に使われた目標価格と達成度。
  // 目標価格が購入価格を上回っていない場合はnull(下落局面で目標も一緒に下がり、
  // 達成率が実態と無関係に押し上げられるのを防ぐための無効化)。
  effectiveTargetPrice: number | null;
  effectiveTargetPriceLogic: EffectiveTargetPriceLogic | null;
  achievementPercent: number | null;
  // 手数料・税引後の想定損益(概算)。netProfitが黒字でない場合、shouldTakeProfitは
  // falseに強制される(額面上は利確条件を満たしていても、実質的な利益が出ない場合は
  // 利確シグナルとして扱わない)。
  buyCommission: number | null;
  sellCommission: number | null;
  grossGain: number | null;
  estimatedTax: number | null;
  netProfit: number | null;
  shouldTakeProfit: boolean;
  // 保有期間満了による強制決済(損切り・利確とは独立した第3の判定軸。純損益ゲートの対象外)。
  holdingDays: number | null;
  holdingPeriodExitDays: number | null;
  isHoldingPeriodExceeded: boolean;
  judgmentGroupName: string | null;
}

export interface TechnicalScoreThreshold {
  threshold: number;
}

// テクニカルスコア計算式(Stage2/相対強度(RS)/出来高急増/RSI適温ゾーン/VCP・52週高値圏/
// MACD上昇モメンタムの6要素)の配点・期間・閾値。設定画面から編集でき、保存すると
// 全対象銘柄のスコアを再計算する。
export interface TechnicalScoreConfig {
  stage2Points: number;
  stage2SmaShortPeriod: number;
  stage2SmaLongPeriod: number;
  stage2TrendLookbackDays: number;
  rsPoints: number;
  rsLookbackDays: number;
  rsThreshold: number;
  volumePoints: number;
  volumeAveragePeriod: number;
  volumeRatioThreshold: number;
  rsiPoints: number;
  rsiPeriod: number;
  rsiComfortLow: number;
  rsiComfortHigh: number;
  rsiOverboughtThreshold: number;
  rsiOverboughtPenalty: number;
  vcpPoints: number;
  vcpHigh52WRatioThreshold: number;
  vcpVolatilityLookbackDays: number;
  vcpAtrPeriod: number;
  vcpHistoryLookbackDays: number;
  macdPoints: number;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  benchmarkSymbol: string;
  historyPeriod: string;
}

export interface CapitalGainsTaxRate {
  rate: number;
}

export interface TradingFeeTier {
  tierId: number;
  maxTradeValue: number | null;
  commission: number;
}

export interface UpsertTradingFeeTierRequest {
  maxTradeValue: number | null;
  commission: number;
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
  accountType: AccountType;
}

export interface CreateTradeRequest {
  action: "buy" | "sell";
  price: number;
  quantity: number;
  screeningGroupId: number | null;
  memo: string | null;
  accountType: AccountType;
}
