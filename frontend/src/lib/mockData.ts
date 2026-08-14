import type {
  BatchLog,
  MarketIndicator,
  NewsItem,
  PricePoint,
  ScreeningGroup,
  StockWithStatus,
  Tag,
  TradeHistoryEntry,
} from "@/types";

// バックエンド(FastAPI)実装までのUI開発用モックデータ。
// 実APIに差し替える際は lib/api.ts の各関数の中身だけを置き換えればよい構成にしている。

export const TAGS: Tag[] = [
  { tagId: 1, name: "26年注目", color: "#3ea6ff" },
  { tagId: 2, name: "長期保有", color: "#00c853" },
  { tagId: 3, name: "高配当", color: "#ffab00" },
  { tagId: 4, name: "グロース", color: "#e040fb" },
];

const BASE_STOCKS: Omit<
  StockWithStatus,
  | "latestClose"
  | "changePercent"
  | "screeningScore"
  | "tags"
  | "purchaseScore"
  | "targetPriceAuto"
  | "targetPriceManual"
  | "targetPriceAtPurchase"
  | "targetPriceAutoLogic"
  | "targetPriceAtPurchaseLogic"
>[] = [
  { tickerSymbol: "7203.T", name: "トヨタ自動車", marketSegment: "プライム（内国株式）", sector: "輸送用機器", isUnderSupervision: false, isDelistingRisk: false, status: "holding" },
  { tickerSymbol: "6758.T", name: "ソニーグループ", marketSegment: "プライム（内国株式）", sector: "電気機器", isUnderSupervision: false, isDelistingRisk: false, status: "holding" },
  { tickerSymbol: "9984.T", name: "ソフトバンクグループ", marketSegment: "プライム（内国株式）", sector: "情報・通信業", isUnderSupervision: false, isDelistingRisk: false, status: "interested" },
  { tickerSymbol: "8035.T", name: "東京エレクトロン", marketSegment: "プライム（内国株式）", sector: "電気機器", isUnderSupervision: false, isDelistingRisk: false, status: "interested" },
  { tickerSymbol: "6920.T", name: "レーザーテック", marketSegment: "プライム（内国株式）", sector: "電気機器", isUnderSupervision: false, isDelistingRisk: false, status: "interested" },
  { tickerSymbol: "9433.T", name: "KDDI", marketSegment: "プライム（内国株式）", sector: "情報・通信業", isUnderSupervision: false, isDelistingRisk: false, status: "holding" },
  { tickerSymbol: "8058.T", name: "三菱商事", marketSegment: "プライム（内国株式）", sector: "卸売業", isUnderSupervision: false, isDelistingRisk: false, status: null },
  { tickerSymbol: "4587.T", name: "ペプチドリーム", marketSegment: "プライム（内国株式）", sector: "医薬品", isUnderSupervision: false, isDelistingRisk: false, status: null },
  { tickerSymbol: "9983.T", name: "ファーストリテイリング", marketSegment: "プライム（内国株式）", sector: "小売業", isUnderSupervision: false, isDelistingRisk: false, status: "sold" },
  { tickerSymbol: "3676.T", name: "デジタルハーツホールディングス", marketSegment: "プライム（内国株式）", sector: "情報・通信業", isUnderSupervision: true, isDelistingRisk: false, status: "excluded" },
  { tickerSymbol: "3480.T", name: "ジェイ・エス・ビー", marketSegment: "プライム（内国株式）", sector: "不動産業", isUnderSupervision: false, isDelistingRisk: true, status: "excluded" },
  { tickerSymbol: "6098.T", name: "リクルートホールディングス", marketSegment: "プライム（内国株式）", sector: "サービス業", isUnderSupervision: false, isDelistingRisk: false, status: null },
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function generatePriceHistory(seed: number, basePrice: number, days = 260): PricePoint[] {
  const rand = seededRandom(seed);
  const points: PricePoint[] = [];
  let price = basePrice;
  const today = new Date();

  for (let i = days; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const open = price;
    const drift = (rand() - 0.48) * 0.02;
    price = Math.max(price * (1 + drift), basePrice * 0.4);
    const close = price;
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    const volume = Math.round(500_000 + rand() * 3_000_000);
    points.push({
      date: date.toISOString().slice(0, 10),
      open: Math.round(open * 10) / 10,
      high: Math.round(high * 10) / 10,
      low: Math.round(low * 10) / 10,
      close: Math.round(close * 10) / 10,
      volume,
    });
  }
  return points;
}

const PRICE_HISTORY: Record<string, PricePoint[]> = Object.fromEntries(
  BASE_STOCKS.map((stock, index) => [
    stock.tickerSymbol,
    generatePriceHistory(index + 1, 1000 + index * 800),
  ])
);

export const MOCK_STOCKS: StockWithStatus[] = BASE_STOCKS.map((stock, index) => {
  const history = PRICE_HISTORY[stock.tickerSymbol];
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const changePercent = prev ? ((latest.close - prev.close) / prev.close) * 100 : 0;

  return {
    ...stock,
    latestClose: latest.close,
    changePercent: Math.round(changePercent * 100) / 100,
    screeningScore: [40, 15, 55, 70, 65, 20, null, 25, null, null, null, 30][index] ?? null,
    purchaseScore: null,
    targetPriceAuto: null,
    targetPriceManual: null,
    targetPriceAtPurchase: null,
    targetPriceAutoLogic: null,
    targetPriceAtPurchaseLogic: null,
    tags:
      index % 3 === 0
        ? [TAGS[0]]
        : index % 3 === 1
          ? [TAGS[1], TAGS[2]]
          : [],
  };
});

export function getMockPriceHistory(tickerSymbol: string): PricePoint[] {
  return PRICE_HISTORY[tickerSymbol] ?? [];
}

export const MOCK_BATCH_LOGS: BatchLog[] = [
  { logId: 5, processName: "jpx_import", status: "SUCCESS", retryCount: 0, errorMessage: null, createdAt: "2026-08-12T09:00:04Z", updatedAt: "2026-08-12T09:00:07Z" },
  { logId: 4, processName: "jpx_import", status: "FAILED", retryCount: 0, errorMessage: "404 Client Error: Not Found", createdAt: "2026-08-11T09:00:01Z", updatedAt: "2026-08-11T09:00:02Z" },
  { logId: 3, processName: "technical_screen", status: "SUCCESS", retryCount: 0, errorMessage: null, createdAt: "2026-08-11T06:30:11Z", updatedAt: "2026-08-11T06:32:40Z" },
  { logId: 2, processName: "fx_rate_import", status: "SUCCESS", retryCount: 1, errorMessage: null, createdAt: "2026-08-11T05:00:00Z", updatedAt: "2026-08-11T05:05:12Z" },
  { logId: 1, processName: "news_import", status: "RETRYING", retryCount: 2, errorMessage: "Timeout while calling NewsAPI", createdAt: "2026-08-11T04:00:00Z", updatedAt: "2026-08-11T04:35:00Z" },
];

export const MOCK_MARKET_INDICATORS: MarketIndicator[] = [
  { date: "2026-08-12", fxUsdJpy: 148.32 },
  { date: "2026-08-11", fxUsdJpy: 148.05 },
  { date: "2026-08-08", fxUsdJpy: 147.61 },
];

export const MOCK_NEWS: NewsItem[] = [
  { id: "n1", title: "トヨタ、次世代EVの生産計画を発表", url: "https://example.com/news/1", source: "日経電子版", publishedAt: "2026-08-12T07:30:00Z", relatedTickerSymbols: ["7203.T"] },
  { id: "n2", title: "半導体関連株が軒並み上昇、AI需要が追い風", url: "https://example.com/news/2", source: "ロイター", publishedAt: "2026-08-12T06:10:00Z", relatedTickerSymbols: ["8035.T", "6920.T"] },
  { id: "n3", title: "ソフトバンクG、投資先の上場観測で思惑買い", url: "https://example.com/news/3", source: "Bloomberg", publishedAt: "2026-08-11T22:45:00Z", relatedTickerSymbols: ["9984.T"] },
  { id: "n4", title: "デジタルハーツHD、監理銘柄指定を受け株価急落", url: "https://example.com/news/4", source: "日経電子版", publishedAt: "2026-08-06T15:00:00Z", relatedTickerSymbols: ["3676.T"] },
];

export const MOCK_SCREENING_GROUPS: ScreeningGroup[] = [
  {
    groupId: 1,
    name: "高配当戦略",
    description: "配当利回り重視・減配リスクを回避",
    isActive: true,
    isDefault: false,
    candidateScreeningActive: true,
    signalCountThreshold: null,
    holdingPeriodExitDays: null,
    rules: [
      { ruleId: 1, rulePurpose: "candidate", category: "A", paramKey: "is_delisting_risk", operator: "eq", valueMode: "fixed", paramValue: 1 },
      { ruleId: 2, rulePurpose: "candidate", category: "B", paramKey: "dividend_per_share_yoy", operator: "lte", valueMode: "fixed", paramValue: 0 },
      { ruleId: 3, rulePurpose: "candidate", category: "C", paramKey: "pbr", operator: "lte", valueMode: "fixed", paramValue: 1.0 },
    ],
  },
  {
    groupId: 2,
    name: "グロース戦略",
    description: "ステージ2・相対強度重視のモメンタム戦略",
    isActive: true,
    isDefault: false,
    candidateScreeningActive: true,
    signalCountThreshold: null,
    holdingPeriodExitDays: null,
    rules: [
      { ruleId: 4, rulePurpose: "candidate", category: "A", paramKey: "is_under_supervision", operator: "eq", valueMode: "fixed", paramValue: 1 },
      { ruleId: 5, rulePurpose: "candidate", category: "B", paramKey: "operating_profit_yoy", operator: "lte", valueMode: "fixed", paramValue: 0 },
      { ruleId: 6, rulePurpose: "candidate", category: "C", paramKey: "relative_strength", operator: "gte", valueMode: "fixed", paramValue: 1.3 },
    ],
  },
];

export const MOCK_TRADE_HISTORY: TradeHistoryEntry[] = [
  { tradeId: 1, tickerSymbol: "9983.T", action: "sell", price: 42500, quantity: 100, tradedAt: "2026-07-20T09:05:00Z", screeningGroupId: 2, screeningGroupName: "グロース戦略", memo: "目標株価到達のため利確", accountType: "taxable" },
  { tradeId: 2, tickerSymbol: "7203.T", action: "buy", price: 2850, quantity: 300, tradedAt: "2026-05-12T09:10:00Z", screeningGroupId: 1, screeningGroupName: "高配当戦略", memo: "ステージ2判定+RS上位で建玉", accountType: "taxable" },
];
