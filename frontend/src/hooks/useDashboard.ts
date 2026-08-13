import { useQuery } from "@tanstack/react-query";
import { fetchBatchLogs, fetchMarketIndicators, fetchNews } from "@/lib/api";

export function useBatchLogs() {
  return useQuery({ queryKey: ["batchLogs"], queryFn: fetchBatchLogs });
}

export function useMarketIndicators() {
  return useQuery({ queryKey: ["marketIndicators"], queryFn: fetchMarketIndicators });
}

export function useNews(tickerSymbol?: string) {
  return useQuery({ queryKey: ["news", tickerSymbol ?? "all"], queryFn: () => fetchNews(tickerSymbol) });
}
