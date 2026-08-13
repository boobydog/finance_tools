"use client";

import { Box, Typography, Paper, Grid, CircularProgress, Stack } from "@mui/material";
import { useBatchLogs, useMarketIndicators, useNews } from "@/hooks/useDashboard";
import { BatchLogTable } from "@/components/dashboard/BatchLogTable";
import { NewsList } from "@/components/dashboard/NewsList";

export default function DashboardPage() {
  const { data: batchLogs, isLoading: logsLoading } = useBatchLogs();
  const { data: marketIndicators, isLoading: fxLoading } = useMarketIndicators();
  const { data: news, isLoading: newsLoading } = useNews();

  const latestFx = marketIndicators?.[0];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        ダッシュボード
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              米ドル/円
            </Typography>
            {fxLoading ? (
              <CircularProgress size={20} />
            ) : (
              <Typography variant="h4">{latestFx?.fxUsdJpy?.toFixed(2) ?? "-"}</Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {latestFx ? new Date(latestFx.date).toLocaleDateString("ja-JP") : ""} 時点(Frankfurter API)
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              バッチ実行ログ
            </Typography>
            {logsLoading ? (
              <CircularProgress size={20} />
            ) : (
              <BatchLogTable logs={batchLogs ?? []} />
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          市場ニュース
        </Typography>
        {newsLoading ? (
          <Stack sx={{ alignItems: "center", py: 2 }}>
            <CircularProgress size={20} />
          </Stack>
        ) : (
          <NewsList news={news ?? []} />
        )}
      </Paper>
    </Box>
  );
}
