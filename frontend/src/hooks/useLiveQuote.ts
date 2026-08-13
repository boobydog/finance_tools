import { useQuery } from "@tanstack/react-query";
import { fetchLiveQuote, fetchLiveQuotes } from "@/lib/api";
import { isTseMarketOpen } from "@/lib/marketHours";

// 銘柄詳細画面を開いている間だけ、その1銘柄のみを対象に定期取得する。
// yfinanceはリアルタイム配信ではなく無料の非公式取得手段のため、
// 高頻度・大量アクセスによるレート制限を避けて1分間隔にしている。
const LIVE_QUOTE_REFETCH_INTERVAL_MS = 60_000;

// 一覧画面は表示中の銘柄(最大50件)をまとめて取得するため、間隔を長めにする。
const LIVE_QUOTES_REFETCH_INTERVAL_MS = 120_000;

// 取引時間外は株価が動かないため、頻繁に再取得する意味がない
// (バックエンドもyfinanceを呼ばずキャッシュを返すだけになる)。
// 間隔を大きく延ばしつつ、取引時間になれば自動的に短い間隔へ戻す。
const CLOSED_MARKET_REFETCH_INTERVAL_MS = 10 * 60_000;

export function useLiveQuote(tickerSymbol: string) {
  return useQuery({
    queryKey: ["liveQuote", tickerSymbol],
    queryFn: () => fetchLiveQuote(tickerSymbol),
    enabled: Boolean(tickerSymbol),
    refetchInterval: () =>
      isTseMarketOpen() ? LIVE_QUOTE_REFETCH_INTERVAL_MS : CLOSED_MARKET_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useLiveQuotes(tickerSymbols: string[]) {
  const key = [...tickerSymbols].sort().join(",");
  return useQuery({
    queryKey: ["liveQuotes", key],
    queryFn: () => fetchLiveQuotes(tickerSymbols),
    enabled: tickerSymbols.length > 0,
    refetchInterval: () =>
      isTseMarketOpen() ? LIVE_QUOTES_REFETCH_INTERVAL_MS : CLOSED_MARKET_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
