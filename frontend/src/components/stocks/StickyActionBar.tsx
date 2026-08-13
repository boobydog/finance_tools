"use client";

import { Paper, Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { StockWithStatus } from "@/types";
import { StatusActions } from "./StatusActions";

// スマホ操作(外出先からのステータス変更)を想定し、選択中の銘柄に対する
// 操作を画面下部に固定表示する。親指で届く位置にボタンを配置する。
export function StickyActionBar({
  stock,
  onClose,
}: {
  stock: StockWithStatus;
  onClose: () => void;
}) {
  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        p: 1.5,
        zIndex: (t) => t.zIndex.appBar,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" noWrap>
          {stock.name}({stock.tickerSymbol})
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="閉じる">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <StatusActions
        tickerSymbol={stock.tickerSymbol}
        stockName={stock.name}
        currentStatus={stock.status}
        fullWidth
      />
    </Paper>
  );
}
