import type {
  BatchLog,
  CapitalGainsTaxRate,
  CreateScreeningRuleRequest,
  CreateTradeRequest,
  EntrySignal,
  LiveQuote,
  LossCutSignal,
  MarketIndicator,
  NewsItem,
  PriceHistoryInterval,
  PricePoint,
  ProfitTakingSignal,
  ScreeningGroup,
  ScreeningParamDefinition,
  ScreeningRulesExport,
  StockStatus,
  StockWithStatus,
  Tag,
  TechnicalScoreConfig,
  TechnicalScoreThreshold,
  TradeHistoryEntry,
  TradingFeeTier,
  UpsertScreeningGroupRequest,
  UpsertTradingFeeTierRequest,
} from "@/types";

// FastAPI(batch/api)を叩く実装。

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${init?.method ?? "GET"} ${path} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchStocks(): Promise<StockWithStatus[]> {
  return apiFetch<StockWithStatus[]>("/api/stocks");
}

export async function fetchStock(tickerSymbol: string): Promise<StockWithStatus | undefined> {
  try {
    return await apiFetch<StockWithStatus>(`/api/stocks/${encodeURIComponent(tickerSymbol)}`);
  } catch {
    return undefined;
  }
}

export async function fetchPriceHistory(
  tickerSymbol: string,
  interval: PriceHistoryInterval = "daily"
): Promise<PricePoint[]> {
  return apiFetch<PricePoint[]>(
    `/api/stocks/${encodeURIComponent(tickerSymbol)}/price-history?interval=${interval}`
  );
}

export async function fetchLiveQuote(tickerSymbol: string): Promise<LiveQuote> {
  return apiFetch<LiveQuote>(`/api/stocks/${encodeURIComponent(tickerSymbol)}/live-quote`);
}

export async function fetchLiveQuotes(tickerSymbols: string[]): Promise<LiveQuote[]> {
  if (tickerSymbols.length === 0) return [];
  const params = new URLSearchParams({ symbols: tickerSymbols.join(",") });
  return apiFetch<LiveQuote[]>(`/api/live-quotes?${params.toString()}`);
}

export async function updateStockStatus(
  tickerSymbol: string,
  status: StockStatus
): Promise<StockWithStatus> {
  return apiFetch<StockWithStatus>(`/api/stocks/${encodeURIComponent(tickerSymbol)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function fetchTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>("/api/tags");
}

// スクリーニンググループ名と同じタグを付けると、次回の判定エンジン評価からそのグループの
// 基準が適用される(グループ解決はタグの一致で行うため)。候補スクリーニングは既に
// ステータスが設定された銘柄を再評価しないため、保有中銘柄に別グループの基準を
// 後から適用したい場合はこれを使う。
export async function attachStockTag(
  tickerSymbol: string,
  body: { tagId?: number; tagName?: string }
): Promise<StockWithStatus> {
  return apiFetch<StockWithStatus>(`/api/stocks/${encodeURIComponent(tickerSymbol)}/tags`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function detachStockTag(tickerSymbol: string, tagId: number): Promise<StockWithStatus> {
  return apiFetch<StockWithStatus>(`/api/stocks/${encodeURIComponent(tickerSymbol)}/tags/${tagId}`, {
    method: "DELETE",
  });
}

export async function fetchBatchLogs(): Promise<BatchLog[]> {
  return apiFetch<BatchLog[]>("/api/batch-logs");
}

export async function fetchMarketIndicators(): Promise<MarketIndicator[]> {
  return apiFetch<MarketIndicator[]>("/api/market-indicators");
}

export async function fetchNews(tickerSymbol?: string): Promise<NewsItem[]> {
  const query = tickerSymbol ? `?ticker_symbol=${encodeURIComponent(tickerSymbol)}` : "";
  return apiFetch<NewsItem[]>(`/api/news${query}`);
}

export async function fetchScreeningGroups(): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>("/api/screening-groups");
}

export async function fetchScreeningParamDefinitions(): Promise<ScreeningParamDefinition[]> {
  return apiFetch<ScreeningParamDefinition[]>("/api/screening-param-definitions");
}

export async function createScreeningGroup(
  body: UpsertScreeningGroupRequest
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>("/api/screening-groups", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateScreeningGroup(
  groupId: number,
  body: UpsertScreeningGroupRequest
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteScreeningGroup(groupId: number): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-groups/${groupId}`, { method: "DELETE" });
}

export async function updateScreeningGroupActive(
  groupId: number,
  isActive: boolean
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-groups/${groupId}/active`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

export async function updateScreeningGroupCandidateActive(
  groupId: number,
  candidateScreeningActive: boolean
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-groups/${groupId}/candidate-active`, {
    method: "PUT",
    body: JSON.stringify({ candidateScreeningActive }),
  });
}

export async function createScreeningRule(
  groupId: number,
  body: CreateScreeningRuleRequest
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-groups/${groupId}/rules`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateScreeningRule(
  ruleId: number,
  body: CreateScreeningRuleRequest
): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-rules/${ruleId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteScreeningRule(ruleId: number): Promise<ScreeningGroup[]> {
  return apiFetch<ScreeningGroup[]>(`/api/screening-rules/${ruleId}`, { method: "DELETE" });
}

export async function exportScreeningRules(): Promise<ScreeningRulesExport> {
  return apiFetch<ScreeningRulesExport>("/api/screening-rules/export");
}

export async function importScreeningRules(
  body: ScreeningRulesExport
): Promise<ScreeningRulesExport> {
  return apiFetch<ScreeningRulesExport>("/api/screening-rules/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchEntrySignals(): Promise<EntrySignal[]> {
  return apiFetch<EntrySignal[]>("/api/entry-signals");
}

export async function fetchLossCutSignals(): Promise<LossCutSignal[]> {
  return apiFetch<LossCutSignal[]>("/api/loss-cut-signals");
}

export async function fetchProfitTakingSignals(): Promise<ProfitTakingSignal[]> {
  return apiFetch<ProfitTakingSignal[]>("/api/profit-taking-signals");
}

export async function fetchTechnicalScoreThreshold(): Promise<TechnicalScoreThreshold> {
  return apiFetch<TechnicalScoreThreshold>("/api/settings/technical-score-threshold");
}

export async function updateTechnicalScoreThreshold(
  threshold: number
): Promise<TechnicalScoreThreshold> {
  return apiFetch<TechnicalScoreThreshold>("/api/settings/technical-score-threshold", {
    method: "PUT",
    body: JSON.stringify({ threshold }),
  });
}

export async function fetchTechnicalScoreConfig(): Promise<TechnicalScoreConfig> {
  return apiFetch<TechnicalScoreConfig>("/api/settings/technical-score-config");
}

export async function updateTechnicalScoreConfig(
  config: TechnicalScoreConfig
): Promise<TechnicalScoreConfig> {
  return apiFetch<TechnicalScoreConfig>("/api/settings/technical-score-config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function fetchCapitalGainsTaxRate(): Promise<CapitalGainsTaxRate> {
  return apiFetch<CapitalGainsTaxRate>("/api/settings/capital-gains-tax-rate");
}

export async function updateCapitalGainsTaxRate(rate: number): Promise<CapitalGainsTaxRate> {
  return apiFetch<CapitalGainsTaxRate>("/api/settings/capital-gains-tax-rate", {
    method: "PUT",
    body: JSON.stringify({ rate }),
  });
}

export async function fetchTradingFeeTiers(): Promise<TradingFeeTier[]> {
  return apiFetch<TradingFeeTier[]>("/api/trading-fee-tiers");
}

export async function createTradingFeeTier(
  body: UpsertTradingFeeTierRequest
): Promise<TradingFeeTier[]> {
  return apiFetch<TradingFeeTier[]>("/api/trading-fee-tiers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTradingFeeTier(
  tierId: number,
  body: UpsertTradingFeeTierRequest
): Promise<TradingFeeTier[]> {
  return apiFetch<TradingFeeTier[]>(`/api/trading-fee-tiers/${tierId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTradingFeeTier(tierId: number): Promise<TradingFeeTier[]> {
  return apiFetch<TradingFeeTier[]>(`/api/trading-fee-tiers/${tierId}`, { method: "DELETE" });
}

export async function fetchTradeHistory(tickerSymbol?: string): Promise<TradeHistoryEntry[]> {
  const query = tickerSymbol ? `?ticker_symbol=${encodeURIComponent(tickerSymbol)}` : "";
  return apiFetch<TradeHistoryEntry[]>(`/api/trade-history${query}`);
}

export async function createTrade(
  tickerSymbol: string,
  body: CreateTradeRequest
): Promise<StockWithStatus> {
  return apiFetch<StockWithStatus>(`/api/stocks/${encodeURIComponent(tickerSymbol)}/trades`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteTrade(tradeId: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/trades/${tradeId}`, { method: "DELETE" });
}
