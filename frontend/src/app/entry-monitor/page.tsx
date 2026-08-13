"use client";

import { Box, Typography, CircularProgress, Chip, Stack, Tooltip } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Link from "next/link";
import { useEntrySignals } from "@/hooks/useStocks";
import type { EntrySignal } from "@/types";

// 有力候補(シグナル数がしきい値以上)の行は文字色を緑にする(通常時が白い部分のみ)。
// 判定は該当グループ(なければデフォルトグループ)の基準でサーバー側評価済みの値を使う。
function rowHighlight(row: EntrySignal): "success.main" | undefined {
  return row.isStrongCandidate ? "success.main" : undefined;
}

// 除外条件(分類A)のparam_keyごとに、根拠を1行の文言にする。
const EXCLUSION_LABEL: Record<string, (row: EntrySignal) => string> = {
  screening_score: (row) => `スコア不足(${row.screeningScore ?? "-"}点)`,
  rsi: (row) => `RSI過熱(${row.rsi?.toFixed(1) ?? "-"})`,
  ma25_deviation_percent: (row) => `MA25乖離しすぎ(+${row.ma25DeviationPercent?.toFixed(1) ?? "-"}%)`,
  daily_change_percent: (row) => `前日比急騰(+${row.dailyChangePercent?.toFixed(1) ?? "-"}%)`,
  ma25_above_streak_days: (row) => `上抜け直後(${row.ma25AboveStreakDays ?? "-"}日目)`,
};

function exclusionReason(row: EntrySignal): string {
  if (!row.excludedParamKey) return "除外";
  return EXCLUSION_LABEL[row.excludedParamKey]?.(row) ?? "除外";
}

const columns: GridColDef<EntrySignal>[] = [
  {
    field: "name",
    headerName: "銘柄",
    flex: 1.2,
    minWidth: 200,
    renderCell: ({ row }) => (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, lineHeight: 1.3, py: 1 }}>
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
    field: "currentPrice",
    headerName: "現在値",
    flex: 0.6,
    minWidth: 100,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.currentPrice != null ? row.currentPrice.toLocaleString() : "-"}
      </Typography>
    ),
  },
  {
    field: "ma25",
    headerName: "MA25(トレンド転換の目安)",
    flex: 0.9,
    minWidth: 170,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.ma25 != null ? row.ma25.toLocaleString() : "-"}
      </Typography>
    ),
  },
  {
    field: "volumeRatio",
    headerName: "出来高倍率",
    flex: 0.7,
    minWidth: 130,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.volumeRatio != null ? `${row.volumeRatio.toFixed(2)}倍` : "-"}
      </Typography>
    ),
  },
  {
    field: "earningsSurprisePercent",
    headerName: "決算サプライズ",
    flex: 0.7,
    minWidth: 140,
    type: "number",
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {row.earningsSurprisePercent != null
          ? `${row.earningsSurprisePercent > 0 ? "+" : ""}${row.earningsSurprisePercent.toFixed(1)}%`
          : "-"}
      </Typography>
    ),
  },
  {
    field: "signalCount",
    headerName: "シグナル",
    flex: 0.8,
    minWidth: 150,
    valueGetter: (_value, row) => row.signalCount,
    renderCell: ({ row }) => (
      <Stack spacing={0.25} sx={{ justifyContent: "center", height: "100%" }}>
        <Tooltip title={`該当シグナル数/シグナル総数(有力候補には${row.signalCountThreshold ?? "-"}件必要)`}>
          <Chip
            size="small"
            sx={{
              width: "fit-content",
              ...(row.signalCount === 2 && !row.isStrongCandidate
                ? { bgcolor: "#c0ca33", color: "#1a1a1a" }
                : {}),
            }}
            label={`${row.signalCount}/${row.signalTotal}`}
            color={
              row.isStrongCandidate
                ? "success"
                : row.signalCount === 0
                  ? "default"
                  : row.signalCount === 2
                    ? undefined
                    : "warning"
            }
            variant={row.signalCount === 0 ? "outlined" : "filled"}
          />
        </Tooltip>
        {row.isExcluded && (
          <Typography variant="caption" color="error.main">
            {exclusionReason(row)}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    field: "judgmentGroupName",
    headerName: "判定グループ",
    flex: 0.7,
    minWidth: 130,
    renderCell: ({ row }) => (
      <Typography variant="caption" color="text.secondary">
        {row.judgmentGroupName ?? "-"}
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
];

export default function EntryMonitorPage() {
  const { data: signals, isLoading } = useEntrySignals();

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          買入タイミング判定
        </Typography>
        <Tooltip title="複数シグナルの重複確認により、既に上昇トレンドが確立した銘柄を狙う戦略です(まだ底打ちしていない反転狙いの銘柄は対象外)。">
          <Chip label="確立モメンタム戦略" size="small" color="info" variant="outlined" />
        </Tooltip>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        候補(候補ステータス)銘柄について、トレンド転換(MA25上抜け)・出来高急増・決算の市場予想超えのシグナルを確認できます。
        判定基準は銘柄が属するスクリーニンググループ(設定画面で編集可能)ごとに異なり、シグナル数がしきい値以上の有力候補の行は緑色で表示されます。
        除外条件(スコア不足・RSI過熱・MA25からの乖離しすぎ・前日比の急騰・上抜け直後など)に該当する銘柄は、シグナル数を満たしていても有力候補になりません(単日の急騰を誤って拾わないための対策です)。
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : signals?.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          候補銘柄がありません。
        </Typography>
      ) : (
        <DataGrid
          rows={signals ?? []}
          columns={columns}
          getRowId={(row) => row.tickerSymbol}
          getRowHeight={() => "auto"}
          autoHeight
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: "screeningScore", sort: "desc" }] },
          }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </Box>
  );
}
