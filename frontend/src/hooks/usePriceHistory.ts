import { useQuery } from "@tanstack/react-query";
import { fetchPriceHistory } from "@/lib/api";
import type { PriceHistoryInterval } from "@/types";

export function usePriceHistory(tickerSymbol: string, interval: PriceHistoryInterval = "daily") {
  return useQuery({
    queryKey: ["priceHistory", tickerSymbol, interval],
    queryFn: () => fetchPriceHistory(tickerSymbol, interval),
    enabled: Boolean(tickerSymbol),
  });
}
