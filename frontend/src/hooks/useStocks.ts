import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrade,
  fetchEntrySignals,
  fetchLossCutSignals,
  fetchProfitTakingSignals,
  fetchStock,
  fetchStocks,
  updateStockStatus,
} from "@/lib/api";
import type { CreateTradeRequest, StockStatus, StockWithStatus } from "@/types";

export const stocksQueryKey = ["stocks"] as const;
export const stockQueryKey = (tickerSymbol: string) => ["stocks", tickerSymbol] as const;

export function useStocks() {
  return useQuery({ queryKey: stocksQueryKey, queryFn: fetchStocks });
}

export function useEntrySignals() {
  return useQuery({ queryKey: ["entrySignals"], queryFn: fetchEntrySignals });
}

export function useLossCutSignals() {
  return useQuery({ queryKey: ["lossCutSignals"], queryFn: fetchLossCutSignals });
}

export function useProfitTakingSignals() {
  return useQuery({ queryKey: ["profitTakingSignals"], queryFn: fetchProfitTakingSignals });
}

export function useStock(tickerSymbol: string) {
  return useQuery({
    queryKey: stockQueryKey(tickerSymbol),
    queryFn: () => fetchStock(tickerSymbol),
    enabled: Boolean(tickerSymbol),
  });
}

export function useUpdateStockStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tickerSymbol, status }: { tickerSymbol: string; status: StockStatus }) =>
      updateStockStatus(tickerSymbol, status),
    // 外出先からのステータス変更を想定し、楽観的更新で即座にUIへ反映する。
    onMutate: async ({ tickerSymbol, status }) => {
      await queryClient.cancelQueries({ queryKey: stocksQueryKey });
      const previous = queryClient.getQueryData<StockWithStatus[]>(stocksQueryKey);

      queryClient.setQueryData<StockWithStatus[]>(stocksQueryKey, (old) =>
        old?.map((s) => (s.tickerSymbol === tickerSymbol ? { ...s, status } : s))
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(stocksQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stocksQueryKey });
    },
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tickerSymbol, body }: { tickerSymbol: string; body: CreateTradeRequest }) =>
      createTrade(tickerSymbol, body),
    onSuccess: (_updatedStock, { tickerSymbol }) => {
      queryClient.invalidateQueries({ queryKey: stocksQueryKey });
      queryClient.invalidateQueries({ queryKey: stockQueryKey(tickerSymbol) });
      queryClient.invalidateQueries({ queryKey: ["tradeHistory"] });
    },
  });
}
