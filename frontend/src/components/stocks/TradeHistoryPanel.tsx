"use client";

import { List, ListItem, ListItemText, ListItemSecondaryAction, Typography, Chip, Stack, Box, Divider, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTradeHistory } from "@/hooks/useScreening";
import { useDeleteTrade } from "@/hooks/useStocks";
import type { AccountType } from "@/types";

const ACTION_META = {
  buy: { label: "購入", color: "success" as const },
  sell: { label: "売却", color: "error" as const },
};

const ACCOUNT_TYPE_SHORT_LABEL: Record<AccountType, string> = {
  taxable: "特定/一般",
  nisa: "NISA",
};

// 「なぜその株を買った/避けたか」の振り返りができるよう、根拠にした
// スクリーニンググループとメモを含めて売買履歴を表示する。
export function TradeHistoryPanel({ tickerSymbol }: { tickerSymbol: string }) {
  const { data: trades, isLoading } = useTradeHistory(tickerSymbol);
  const deleteTrade = useDeleteTrade();

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
          <ListItem disablePadding sx={{ py: 1, pr: 5 }}>
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
                  <Chip label={ACCOUNT_TYPE_SHORT_LABEL[trade.accountType]} size="small" variant="outlined" />
                </Stack>
              }
              secondary={
                <>
                  {new Date(trade.tradedAt).toLocaleString("ja-JP")}
                  {trade.memo ? ` ・ ${trade.memo}` : ""}
                </>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                size="small"
                edge="end"
                aria-label="削除"
                disabled={deleteTrade.isPending}
                onClick={() => deleteTrade.mutate({ tradeId: trade.tradeId, tickerSymbol })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        </Box>
      ))}
    </List>
  );
}
