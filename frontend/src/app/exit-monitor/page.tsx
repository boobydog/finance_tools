"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Divider,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "next/link";
import { useLossCutSignals, useProfitTakingSignals } from "@/hooks/useStocks";
import type { LossCutSignal, ProfitTakingSignal } from "@/types";
import {
  classifyTrade,
  exitReason,
  lossCutDrawdownPercent,
  lossCutScoreDiff,
  isTrailingStopTriggered,
  TARGET_PRICE_LOGIC_LABEL,
  type TradeVerdict,
} from "@/lib/tradeSignals";

type ExitRow = {
  tickerSymbol: string;
  name: string;
  sector: string | null;
  currentPrice: number | null;
  lossCut?: LossCutSignal;
  profitTaking?: ProfitTakingSignal;
  verdict: TradeVerdict | null;
};

// 統合判定に応じて行の文字色を変える(通常時が白い部分のみ)。
function rowHighlight(row: ExitRow): "error.main" | "warning.main" | "success.main" | undefined {
  if (row.verdict?.action === "loss_cut_a") return "error.main";
  if (row.verdict?.action === "loss_cut_b") return "warning.main";
  if (row.verdict?.action === "profit_taking") return "success.main";
  return undefined;
}

// 一覧の既定ソート用: 対応が急がれる順(即時売却 > 回避撤退検討 > 利確 > 該当なし)。
function verdictRank(verdict: TradeVerdict | null): number {
  if (verdict?.action === "loss_cut_a") return 0;
  if (verdict?.action === "loss_cut_b") return 1;
  if (verdict?.action === "profit_taking") return 2;
  return 3;
}

const columns: GridColDef<ExitRow>[] = [
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
    flex: 0.7,
    minWidth: 130,
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
    field: "verdict",
    headerName: "判定",
    flex: 0.8,
    minWidth: 150,
    valueGetter: (_value, row) => verdictRank(row.verdict),
    renderCell: ({ row }) =>
      row.verdict ? (
        <Chip size="small" label={row.verdict.label} color={row.verdict.color} />
      ) : (
        <Typography variant="caption" color="text.secondary">
          継続保有
        </Typography>
      ),
  },
  {
    field: "reason",
    headerName: "判定根拠",
    flex: 1,
    minWidth: 180,
    sortable: false,
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: rowHighlight(row) }}>
        {exitReason(row.verdict, row.lossCut, row.profitTaking)}
      </Typography>
    ),
  },
  {
    field: "judgmentGroupName",
    headerName: "判定グループ",
    flex: 0.7,
    minWidth: 130,
    valueGetter: (_value, row) => row.lossCut?.judgmentGroupName ?? row.profitTaking?.judgmentGroupName ?? null,
    renderCell: ({ row }) => (
      <Typography variant="caption" color="text.secondary">
        {row.lossCut?.judgmentGroupName ?? row.profitTaking?.judgmentGroupName ?? "-"}
      </Typography>
    ),
  },
];

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ExitDetailDialog({ row, onClose }: { row: ExitRow | null; onClose: () => void }) {
  if (!row) return null;
  const { lossCut, profitTaking } = row;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h6">{row.name}</Typography>
          {row.verdict && <Chip size="small" label={row.verdict.label} color={row.verdict.color} />}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {row.tickerSymbol} ・ {row.sector ?? "-"}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {lossCut && (
          <DetailSection title="損切り判定">
            <Stack spacing={0.5}>
              <Typography variant="body2">
                優先度: {lossCut.priority ? `${lossCut.priority}(${lossCut.priority === "A" ? "即時売却" : "回避・撤退検討"})` : "該当なし"}
              </Typography>
              <Typography variant="body2">
                スコア差分:{" "}
                {(() => {
                  const diff = lossCutScoreDiff(lossCut);
                  return diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(0)}(購入時${lossCut.purchaseScore ?? "-"})` : "-";
                })()}
              </Typography>
              <Typography variant="body2">
                購入時からの下落率:{" "}
                {(() => {
                  const drawdown = lossCutDrawdownPercent(lossCut);
                  return drawdown !== null ? `${drawdown.toFixed(1)}%` : "-";
                })()}
              </Typography>
              <Typography variant="body2">
                上場廃止/監理リスク: {lossCut.isDelistingRisk || lossCut.isUnderSupervision ? "発生中" : "-"}
              </Typography>
              <Typography variant="body2">
                営業利益前期比: {lossCut.operatingProfitYoy != null ? `${lossCut.operatingProfitYoy.toFixed(1)}%` : "-"}
              </Typography>
              <Typography variant="body2">
                EPS成長率: {lossCut.epsGrowth != null ? `${lossCut.epsGrowth.toFixed(1)}%` : "-"}
              </Typography>
            </Stack>
          </DetailSection>
        )}

        {lossCut && profitTaking && <Divider sx={{ mb: 2 }} />}

        {profitTaking && (
          <DetailSection title="利確判定">
            <Stack spacing={0.5}>
              {profitTaking.achievementPercent !== null && profitTaking.effectiveTargetPrice !== null ? (
                <Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2">
                      目標 {profitTaking.effectiveTargetPrice.toLocaleString()}
                      {profitTaking.effectiveTargetPriceLogic
                        ? `(${TARGET_PRICE_LOGIC_LABEL[profitTaking.effectiveTargetPriceLogic]})`
                        : ""}
                    </Typography>
                    <Typography variant="body2">{profitTaking.achievementPercent.toFixed(0)}%</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(profitTaking.achievementPercent, 100)}
                    color={profitTaking.achievementPercent >= 100 ? "success" : "primary"}
                    sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {profitTaking.targetPriceAuto !== null &&
                  profitTaking.purchasePrice !== null &&
                  profitTaking.targetPriceAuto <= profitTaking.purchasePrice
                    ? "目標価格が購入価格を下回っているため達成度は無効"
                    : "ターゲットプライス未設定"}
                </Typography>
              )}
              <Typography variant="body2">
                PER(予想): {profitTaking.forwardPer !== null ? `${profitTaking.forwardPer.toFixed(1)}倍` : "-"}
              </Typography>
              <Typography variant="body2">
                トレイリングストップ: {isTrailingStopTriggered(profitTaking) ? "発動(逆指値ライン到達)" : "未発動"}
                (最高値 {profitTaking.highestPriceSincePurchase?.toLocaleString() ?? "-"} / 逆指値{" "}
                {profitTaking.trailingStopTriggerPrice?.toLocaleString() ?? "-"})
              </Typography>
            </Stack>
          </DetailSection>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ExitMonitorPage() {
  const { data: lossCutSignals, isLoading: lossCutLoading } = useLossCutSignals();
  const { data: profitTakingSignals, isLoading: profitTakingLoading } = useProfitTakingSignals();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const isLoading = lossCutLoading || profitTakingLoading;
  const lossCutByTicker = new Map((lossCutSignals ?? []).map((s) => [s.tickerSymbol, s]));
  const profitTakingByTicker = new Map((profitTakingSignals ?? []).map((s) => [s.tickerSymbol, s]));
  const tickers = new Set([...lossCutByTicker.keys(), ...profitTakingByTicker.keys()]);

  const rows: ExitRow[] = Array.from(tickers).map((tickerSymbol) => {
    const lossCut = lossCutByTicker.get(tickerSymbol);
    const profitTaking = profitTakingByTicker.get(tickerSymbol);
    const base = lossCut ?? profitTaking!;
    return {
      tickerSymbol,
      name: base.name,
      sector: base.sector,
      currentPrice: base.currentPrice,
      lossCut,
      profitTaking,
      verdict: classifyTrade(undefined, lossCut, profitTaking),
    };
  });

  const detailColumns: GridColDef<ExitRow>[] = [
    ...columns,
    {
      field: "detail",
      headerName: "詳細",
      flex: 0.4,
      minWidth: 70,
      sortable: false,
      renderCell: ({ row }) => (
        <IconButton size="small" onClick={() => setSelectedTicker(row.tickerSymbol)} aria-label="詳細を見る">
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const selectedRow = rows.find((r) => r.tickerSymbol === selectedTicker) ?? null;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        損切り・利確判定
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        保有中銘柄について、損切り・利確どちらの判定基準に該当するかをまとめて確認できます。即時売却(赤)・回避撤退検討(オレンジ)・利確検討(緑)の行は色分けして表示されます。行右端の
        <InfoOutlinedIcon fontSize="inherit" sx={{ verticalAlign: "middle", mx: 0.3 }} />
        から、スコア差分・下落率・目標達成度など詳細な内訳を確認できます。
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          保有中の銘柄がありません。
        </Typography>
      ) : (
        <DataGrid
          rows={rows}
          columns={detailColumns}
          getRowId={(row) => row.tickerSymbol}
          getRowHeight={() => "auto"}
          autoHeight
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: "verdict", sort: "asc" }] },
          }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}

      <ExitDetailDialog row={selectedRow} onClose={() => setSelectedTicker(null)} />
    </Box>
  );
}
