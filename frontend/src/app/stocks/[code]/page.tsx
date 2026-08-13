"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Link as MuiLink,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useStock, useEntrySignals, useLossCutSignals, useProfitTakingSignals } from "@/hooks/useStocks";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { useLiveQuote } from "@/hooks/useLiveQuote";
import { useNews } from "@/hooks/useDashboard";
import { StockPriceChart } from "@/components/charts/StockPriceChart";
import { StatusActions } from "@/components/stocks/StatusActions";
import { StatusChip } from "@/components/stocks/StatusChip";
import { TradeHistoryPanel } from "@/components/stocks/TradeHistoryPanel";
import { priceColor } from "@/lib/theme";
import type { PriceHistoryInterval } from "@/types";
import { classifyTrade, TARGET_PRICE_LOGIC_LABEL } from "@/lib/tradeSignals";

const INTERVAL_OPTIONS: { value: PriceHistoryInterval; label: string }[] = [
  { value: "daily", label: "日足" },
  { value: "weekly", label: "週足" },
  { value: "monthly", label: "月足" },
];

export default function StockDetailPage() {
  const params = useParams<{ code: string }>();
  const tickerSymbol = decodeURIComponent(params.code);
  const [chartInterval, setChartInterval] = useState<PriceHistoryInterval>("daily");

  const { data: stock, isLoading: stockLoading } = useStock(tickerSymbol);
  const { data: priceHistory, isLoading: priceLoading } = usePriceHistory(tickerSymbol, chartInterval);
  const { data: liveQuote, dataUpdatedAt: liveQuoteUpdatedAt } = useLiveQuote(tickerSymbol);
  const { data: news } = useNews(tickerSymbol);
  const { data: entrySignals } = useEntrySignals();
  const { data: lossCutSignals } = useLossCutSignals();
  const { data: profitTakingSignals } = useProfitTakingSignals();
  const tradeVerdict = classifyTrade(
    entrySignals?.find((s) => s.tickerSymbol === tickerSymbol),
    lossCutSignals?.find((s) => s.tickerSymbol === tickerSymbol),
    profitTakingSignals?.find((s) => s.tickerSymbol === tickerSymbol)
  );

  if (stockLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stock) {
    return <Typography>銘柄が見つかりませんでした。</Typography>;
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {stock.name}
            </Typography>
            <StatusChip status={stock.status} />
            {tradeVerdict && <Chip label={tradeVerdict.label} color={tradeVerdict.color} size="small" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {stock.tickerSymbol} ・ {stock.marketSegment ?? "-"} ・ {stock.sector ?? "-"}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          href={`https://finance.yahoo.co.jp/quote/${stock.tickerSymbol}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Yahoo!ファイナンスで見る
        </Button>
      </Stack>

      <Stack direction="row" spacing={3} sx={{ alignItems: "baseline", mb: 1 }}>
        <Typography variant="h4">
          {(liveQuote?.currentPrice ?? stock.latestClose)?.toLocaleString() ?? "-"}
        </Typography>
        {(() => {
          const changePercent = liveQuote?.changePercent ?? stock.changePercent;
          return (
            <Typography variant="h6" sx={{ color: priceColor(changePercent) }}>
              {changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent}%` : "-"}
            </Typography>
          );
        })()}
        {stock.screeningScore !== null && (
          <Chip label={`スクリーニングスコア ${stock.screeningScore}`} color="primary" variant="outlined" />
        )}
      </Stack>

      <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            始値
          </Typography>
          <Typography variant="body1">{liveQuote?.open?.toLocaleString() ?? "-"}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            現在値
          </Typography>
          <Typography variant="body1">{liveQuote?.currentPrice?.toLocaleString() ?? "-"}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            前日終値
          </Typography>
          <Typography variant="body1">{liveQuote?.previousClose?.toLocaleString() ?? "-"}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            更新
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {liveQuoteUpdatedAt ? new Date(liveQuoteUpdatedAt).toLocaleTimeString("ja-JP") : "-"}
            {liveQuote?.isMarketOpen === false ? "(取引時間外・自動更新休止中)" : "(1分ごと自動更新)"}
          </Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          ターゲットプライス
        </Typography>
        {(() => {
          const effective = stock.targetPriceManual ?? stock.targetPriceAtPurchase ?? stock.targetPriceAuto;
          const basis =
            stock.targetPriceManual !== null
              ? "手動設定"
              : stock.targetPriceAtPurchase !== null
                ? stock.targetPriceAtPurchaseLogic
                  ? `${TARGET_PRICE_LOGIC_LABEL[stock.targetPriceAtPurchaseLogic]}(購入時点で固定)`
                  : "購入時点で固定"
                : stock.targetPriceAutoLogic
                  ? `${TARGET_PRICE_LOGIC_LABEL[stock.targetPriceAutoLogic]}(現在値ベースで自動更新)`
                  : null;
          if (effective === null) {
            return (
              <Typography variant="body2" color="text.secondary">
                算出に必要なデータ(EPS成長率・BPS・アナリスト目標株価のいずれか)が未取得のため未設定です。
              </Typography>
            );
          }
          return (
            <Box>
              <Typography variant="h6">{effective.toLocaleString()}円</Typography>
              {basis && (
                <Typography variant="caption" color="text.secondary">
                  算出根拠: {basis}
                </Typography>
              )}
              {stock.status === "holding" && stock.targetPriceAtPurchase === null && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  ※購入時点のスナップショットが未取得のため、現在値ベースの自動算出値を暫定表示しています。
                </Typography>
              )}
            </Box>
          );
        })()}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={chartInterval}
            exclusive
            onChange={(_, value) => value && setChartInterval(value)}
          >
            {INTERVAL_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        {priceLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <StockPriceChart data={priceHistory ?? []} />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          ステータス変更
        </Typography>
        <StatusActions tickerSymbol={stock.tickerSymbol} stockName={stock.name} currentStatus={stock.status} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          売買履歴
        </Typography>
        <TradeHistoryPanel tickerSymbol={stock.tickerSymbol} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          関連ニュース
        </Typography>
        {!news || news.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            関連ニュースはありません。
          </Typography>
        ) : (
          <List disablePadding>
            {news.map((item, index) => (
              <Box key={item.id}>
                {index > 0 && <Divider component="li" />}
                <ListItem disablePadding sx={{ py: 1 }}>
                  <ListItemText
                    primary={
                      <MuiLink href={item.url} target="_blank" rel="noopener noreferrer" underline="hover">
                        {item.title}
                      </MuiLink>
                    }
                    secondary={`${item.source} ・ ${new Date(item.publishedAt).toLocaleString("ja-JP")}`}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
