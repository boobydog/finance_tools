"use client";

import { List, ListItem, ListItemText, Typography, Chip, Stack, Box, Divider } from "@mui/material";
import { useTradeHistory } from "@/hooks/useScreening";

const ACTION_META = {
  buy: { label: "購入", color: "success" as const },
  sell: { label: "売却", color: "error" as const },
};

// 「なぜその株を買った/避けたか」の振り返りができるよう、根拠にした
// スクリーニンググループとメモを含めて売買履歴を表示する。
export function TradeHistoryPanel({ tickerSymbol }: { tickerSymbol: string }) {
  const { data: trades, isLoading } = useTradeHistory(tickerSymbol);

  if (isLoading) return null;

  if (!trades || trades.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        売買履歴はありません。
      </Typography>
    );
  }

  return (
    <List disablePadding>
      {trades.map((trade, index) => (
        <Box key={trade.tradeId}>
          {index > 0 && <Divider component="li" />}
          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Chip
                    label={ACTION_META[trade.action].label}
                    color={ACTION_META[trade.action].color}
                    size="small"
                  />
                  <Typography variant="body2">
                    {trade.price.toLocaleString()}円 × {trade.quantity}株
                  </Typography>
                  {trade.screeningGroupName && (
                    <Chip label={trade.screeningGroupName} size="small" variant="outlined" />
                  )}
                </Stack>
              }
              secondary={
                <>
                  {new Date(trade.tradedAt).toLocaleString("ja-JP")}
                  {trade.memo ? ` ・ ${trade.memo}` : ""}
                </>
              }
            />
          </ListItem>
        </Box>
      ))}
    </List>
  );
}
