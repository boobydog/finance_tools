"use client";

import { useRef, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Button,
  Alert,
  Snackbar,
  Paper,
  TextField,
  Tabs,
  Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import {
  useCreateScreeningGroup,
  useExportScreeningRulesMutation,
  useImportScreeningRules,
  useScreeningGroups,
  useScreeningParamDefinitions,
  useTechnicalScoreThreshold,
  useUpdateTechnicalScoreThreshold,
} from "@/hooks/useScreening";
import { RuleEditor } from "@/components/screening/RuleEditor";
import type { ScreeningRulesExport } from "@/types";

const TABS = [
  { value: "screeningRules", label: "スクリーニング設定" },
  { value: "technicalScore", label: "テクニカルスコア設定" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function TechnicalScoreThresholdSetting() {
  const { data } = useTechnicalScoreThreshold();
  const updateThreshold = useUpdateTechnicalScoreThreshold();
  const [value, setValue] = useState<number | null>(null);

  const displayValue = value ?? data?.threshold ?? "";

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            テクニカルスコアによる自動候補化のしきい値
          </Typography>
          <Typography variant="body2" color="text.secondary">
            このスコア以上、かつステータス未設定の銘柄を自動で「候補」にします。
          </Typography>
        </Box>
        <TextField
          size="small"
          type="number"
          value={displayValue}
          onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={() => {
            if (value !== null && value !== data?.threshold) {
              updateThreshold.mutate(value);
            }
          }}
          sx={{ width: 120 }}
          slotProps={{ htmlInput: { step: 1, min: -100, max: 100 } }}
        />
      </Stack>
    </Paper>
  );
}

function ScreeningRulesPanel() {
  const { data: groups, isLoading } = useScreeningGroups();
  const { data: paramDefinitions } = useScreeningParamDefinitions();
  const createGroup = useCreateScreeningGroup();
  const exportRules = useExportScreeningRulesMutation();
  const importRules = useImportScreeningRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    const data = await exportRules.mutateAsync();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "screening_rules.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ScreeningRulesExport;
      await importRules.mutateAsync(data);
      setError(null);
    } catch {
      setError("JSONの読み込みに失敗しました。ファイル形式を確認してください。");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, mb: 1, gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          候補スクリーニングに加え、グループ別に買入タイミング・損切り判定・利確判定の基準も設定できます。
          候補スクリーニングのインポート/エクスポートは、Pythonバッチが読み込むJSON形式(候補スクリーニング部分のみ)で行えます。
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => createGroup.mutate({ name: "新しいグループ", description: null })}
          >
            グループ追加
          </Button>
          <Button size="small" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
            インポート
          </Button>
          <Button size="small" startIcon={<DownloadIcon />} onClick={handleExport}>
            エクスポート
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {groups?.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              グループが登録されていません。「グループ追加」から作成してください。
            </Typography>
          )}
          {groups?.map((group) => (
            <RuleEditor key={group.groupId} group={group} paramDefinitions={paramDefinitions ?? []} />
          ))}
        </Stack>
      )}

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function ScreeningRulesPage() {
  const [tab, setTab] = useState<TabValue>("screeningRules");

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        判定基準設定
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>

      {tab === "technicalScore" && <TechnicalScoreThresholdSetting />}
      {tab === "screeningRules" && <ScreeningRulesPanel />}
    </Box>
  );
}
