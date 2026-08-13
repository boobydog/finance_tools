"use client";

import { DataGrid, type GridColDef, type GridPaginationModel } from "@mui/x-data-grid";
import { Box, Typography, Stack, Chip } from "@mui/material";
import Link from "next/link";
import type { StockWithStatus } from "@/types";
import { StatusChip } from "./StatusChip";
import { StatusActions } from "./StatusActions";
import { priceColor } from "@/lib/theme";
import type { TradeVerdict } from "@/lib/tradeSignals";

export type StockRow = StockWithStatus & {
  liveOpen?: number | null;
  liveCurrentPrice?: number | null;
  tradeVerdict?: TradeVerdict | null;
};

// 売買判定に応じて行の文字色を変える(通常時が白い部分のみ。タグ・騰落率等、
// 既に独自の色を持つ部分には適用しない)。
function rowHighlight(row: StockRow): `${TradeVerdict["color"]}.main` | undefined {
  return row.tradeVerdict ? (`${row.tradeVerdict.color}.main` as const) : undefined;
}

const columns: GridColDef<StockRow>[] = [
  {
    field: "name",
    headerName: "銘柄",
    flex: 1.2,
    minWidth: 200,
    renderCell: ({ row }) => (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          lineHeight: 1.3,
          py: 1,
        }}
      >
        <Typography
          component={Link}
          href={`/stocks/${row.tickerSymbol}`}
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, color: rowHighlight(row), "&:hover": { textDecoration: "underline" } }}
        >
          {row.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {row.tickerSymbol}
        </Typography>
      </Box>
    ),
  },
  {
    field: "sector",
    headerName: "業種",
    flex: 0.8,
    minWidth: 140,
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.sector ?? "-"}
      </Typography>
    ),
  },
  {
    field: "tradeVerdict",
    headerName: "売買判定",
    flex: 0.8,
    minWidth: 150,
    sortable: false,
    renderCell: ({ row }) =>
      row.tradeVerdict ? (
        <Chip size="small" label={row.tradeVerdict.label} color={row.tradeVerdict.color} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          -
        </Typography>
      ),
  },
  {
    field: "liveOpen",
    headerName: "始値",
    flex: 0.6,
    minWidth: 100,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.liveOpen != null ? row.liveOpen.toLocaleString() : "-"}
      </Typography>
    ),
  },
  {
    field: "liveCurrentPrice",
    headerName: "現在値",
    flex: 0.6,
    minWidth: 100,
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: row.liveCurrentPrice != null ? "info.main" : rowHighlight(row) }}>
        {row.liveCurrentPrice != null ? row.liveCurrentPrice.toLocaleString() : "-"}
      </Typography>
    ),
  },
  {
    field: "latestClose",
    headerName: "終値",
    flex: 0.6,
    minWidth: 100,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.latestClose != null ? row.latestClose.toLocaleString() : "-"}
      </Typography>
    ),
  },
  {
    field: "changePercent",
    headerName: "騰落率",
    flex: 0.6,
    minWidth: 100,
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: priceColor(row.changePercent) }}>
        {row.changePercent !== null
          ? `${row.changePercent > 0 ? "+" : ""}${row.changePercent}%`
          : "-"}
      </Typography>
    ),
  },
  {
    field: "screeningScore",
    headerName: "スコア",
    flex: 0.6,
    minWidth: 90,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.screeningScore ?? "-"}
      </Typography>
    ),
  },
  {
    field: "tags",
    headerName: "タグ",
    flex: 1,
    minWidth: 160,
    sortable: false,
    renderCell: ({ row }) => (
      <Stack direction="column" spacing={0.5} sx={{ py: 1 }}>
        {row.tags.map((tag) => (
          <Chip
            key={tag.tagId}
            label={tag.name}
            size="small"
            sx={{ backgroundColor: tag.color, color: "#0f1115", alignSelf: "flex-start" }}
          />
        ))}
      </Stack>
    ),
  },
  {
    field: "status",
    headerName: "ステータス",
    flex: 0.7,
    minWidth: 110,
    renderCell: ({ row }) => <StatusChip status={row.status} />,
  },
  {
    field: "actions",
    headerName: "操作",
    flex: 1.6,
    minWidth: 260,
    sortable: false,
    renderCell: ({ row }) => (
      <StatusActions
        tickerSymbol={row.tickerSymbol}
        stockName={row.name}
        currentStatus={row.status}
        size="small"
      />
    ),
  },
];

export function StockTable({
  stocks,
  loading,
  paginationModel,
  onPaginationModelChange,
}: {
  stocks: StockRow[];
  loading?: boolean;
  paginationModel?: GridPaginationModel;
  onPaginationModelChange?: (model: GridPaginationModel) => void;
}) {
  return (
    <DataGrid
      rows={stocks}
      columns={columns}
      getRowId={(row) => row.tickerSymbol}
      loading={loading}
      getRowHeight={() => "auto"}
      autoHeight
      disableRowSelectionOnClick
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
      initialState={{
        pagination: { paginationModel: { pageSize: 25 } },
        sorting: { sortModel: [{ field: "screeningScore", sort: "desc" }] },
      }}
      pageSizeOptions={[10, 25, 50]}
    />
  );
}
