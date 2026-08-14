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
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useCapitalGainsTaxRate,
  useCreateScreeningGroup,
  useCreateTradingFeeTier,
  useDeleteTradingFeeTier,
  useExportScreeningRulesMutation,
  useImportScreeningRules,
  useScreeningGroups,
  useScreeningParamDefinitions,
  useTechnicalScoreConfig,
  useTechnicalScoreThreshold,
  useTradingFeeTiers,
  useUpdateCapitalGainsTaxRate,
  useUpdateTechnicalScoreConfig,
  useUpdateTechnicalScoreThreshold,
  useUpdateTradingFeeTier,
} from "@/hooks/useScreening";
import { RuleEditor } from "@/components/screening/RuleEditor";
import type { ScreeningRulesExport, TechnicalScoreConfig, TradingFeeTier } from "@/types";

const TABS = [
  { value: "screeningRules", label: "スクリーニング設定" },
  { value: "technicalScore", label: "テクニカルスコア設定" },
  { value: "tradingCosts", label: "取引コスト設定" },
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

interface TechnicalScoreFieldSpec {
  key: keyof TechnicalScoreConfig;
  label: string;
  unit?: string;
  type: "number" | "text";
  step?: number | "any";
}

interface TechnicalScoreSectionSpec {
  title: string;
  description: string;
  fields: TechnicalScoreFieldSpec[];
}

// テクニカルスコア(technical_screener.py)の計算式を構成する6要素。それぞれの配点・
// 期間・閾値が設定画面から編集できる。⑥MACDは、①(トレンド構造)・④(オシレーター)とは
// 異なる第3の系統(移動平均収束拡散)によるモメンタム転換の確認シグナルとして追加した要素。
const TECHNICAL_SCORE_SECTIONS: TechnicalScoreSectionSpec[] = [
  {
    title: "① ステージ2判定(ワインスタイン)",
    description: "終値が短期・長期SMAを上回り、かつ長期SMAが上昇トレンドであれば加点。",
    fields: [
      { key: "stage2Points", label: "配点", unit: "点", type: "number" },
      { key: "stage2SmaShortPeriod", label: "短期SMA期間", unit: "日", type: "number" },
      { key: "stage2SmaLongPeriod", label: "長期SMA期間", unit: "日", type: "number" },
      { key: "stage2TrendLookbackDays", label: "上昇トレンド確認の遡及日数", unit: "日", type: "number" },
    ],
  },
  {
    title: "② 相対強度(RS)",
    description: "個別株のリターンがベンチマーク(下記)のリターンを一定倍上回れば加点。",
    fields: [
      { key: "rsPoints", label: "配点", unit: "点", type: "number" },
      { key: "rsLookbackDays", label: "比較期間", unit: "日", type: "number" },
      { key: "rsThreshold", label: "加点する閾値", unit: "倍", type: "number", step: "any" },
    ],
  },
  {
    title: "③ 出来高急増",
    description: "直近出来高が平均の一定倍以上であれば加点。",
    fields: [
      { key: "volumePoints", label: "配点", unit: "点", type: "number" },
      { key: "volumeAveragePeriod", label: "平均算出期間", unit: "日", type: "number" },
      { key: "volumeRatioThreshold", label: "加点する倍率閾値", unit: "倍", type: "number", step: "any" },
    ],
  },
  {
    title: "④ RSI適温ゾーン",
    description: "RSIが快適圏なら加点、過熱圏なら減点。",
    fields: [
      { key: "rsiPoints", label: "配点", unit: "点", type: "number" },
      { key: "rsiPeriod", label: "RSI算出期間", unit: "日", type: "number" },
      { key: "rsiComfortLow", label: "快適圏下限", type: "number" },
      { key: "rsiComfortHigh", label: "快適圏上限", type: "number" },
      { key: "rsiOverboughtThreshold", label: "過熱判定の閾値", type: "number" },
      { key: "rsiOverboughtPenalty", label: "過熱時の減点", unit: "点", type: "number" },
    ],
  },
  {
    title: "⑤ VCP・52週高値圏",
    description: "終値が52週高値圏、またはボラティリティ(ATR/終値)が収縮していれば加点。",
    fields: [
      { key: "vcpPoints", label: "配点", unit: "点", type: "number" },
      { key: "vcpHigh52WRatioThreshold", label: "52週高値に対する近さの閾値", unit: "倍", type: "number", step: "any" },
      { key: "vcpVolatilityLookbackDays", label: "ボラティリティ比較期間", unit: "日", type: "number" },
      { key: "vcpAtrPeriod", label: "ATR算出期間", unit: "日", type: "number" },
      { key: "vcpHistoryLookbackDays", label: "52週高値の遡及日数", unit: "日", type: "number" },
    ],
  },
  {
    title: "⑥ MACD上昇モメンタム(新規追加)",
    description:
      "MACD線がシグナル線を上回っていれば加点。①(トレンド構造)・④(オシレーター)とは異なる第3の系統による転換確認シグナル。",
    fields: [
      { key: "macdPoints", label: "配点", unit: "点", type: "number" },
      { key: "macdFastPeriod", label: "短期EMA期間", unit: "日", type: "number" },
      { key: "macdSlowPeriod", label: "長期EMA期間", unit: "日", type: "number" },
      { key: "macdSignalPeriod", label: "シグナル線期間", unit: "日", type: "number" },
    ],
  },
  {
    title: "共通設定",
    description: "全要素で共通して使う設定。",
    fields: [
      { key: "benchmarkSymbol", label: "ベンチマーク銘柄コード", type: "text" },
      { key: "historyPeriod", label: "取得する株価履歴期間", unit: "例: 2y, 1y, 6mo", type: "text" },
    ],
  },
];

function TechnicalScoreFormulaSettings() {
  const { data, isLoading } = useTechnicalScoreConfig();
  const updateConfig = useUpdateTechnicalScoreConfig();
  const [draft, setDraft] = useState<TechnicalScoreConfig | null>(null);

  const config = draft ?? data ?? null;
  const isDirty = draft !== null;

  const setField = (key: keyof TechnicalScoreConfig, value: number | string) => {
    if (!config) return;
    setDraft({ ...config, [key]: value } as TechnicalScoreConfig);
  };

  const handleSave = () => {
    if (!draft) return;
    updateConfig.mutate(draft, { onSuccess: () => setDraft(null) });
  };

  if (isLoading || !config) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        テクニカルスコアは、下記6要素の加点(一部減点)の合計です。各要素の配点・期間・閾値は自由に調整できます。保存すると、対象銘柄全体のスコアをバックグラウンドで再計算します(yfinanceへの問い合わせが発生するため、反映まで数分かかる場合があります)。
      </Alert>
      {TECHNICAL_SCORE_SECTIONS.map((section) => (
        <Paper key={section.title} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {section.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {section.description}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
            {section.fields.map((field) => (
              <TextField
                key={field.key}
                size="small"
                label={field.label}
                type={field.type}
                value={config[field.key]}
                onChange={(e) =>
                  setField(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)
                }
                slotProps={field.type === "number" ? { htmlInput: { step: field.step ?? 1 } } : undefined}
                helperText={field.unit}
                sx={{ width: field.type === "text" ? 220 : 190 }}
              />
            ))}
          </Stack>
        </Paper>
      ))}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Button variant="contained" disabled={!isDirty || updateConfig.isPending} onClick={handleSave}>
          保存して再計算
        </Button>
        {isDirty && (
          <Typography variant="caption" color="text.secondary">
            未保存の変更があります
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

function FeeTierRow({ tier }: { tier: TradingFeeTier }) {
  const updateTier = useUpdateTradingFeeTier();
  const deleteTier = useDeleteTradingFeeTier();
  const [maxTradeValue, setMaxTradeValue] = useState<number | null>(tier.maxTradeValue);
  const [commission, setCommission] = useState<number>(tier.commission);

  const commit = () => {
    if (maxTradeValue === tier.maxTradeValue && commission === tier.commission) return;
    updateTier.mutate({ tierId: tier.tierId, body: { maxTradeValue, commission } });
  };

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <TextField
        size="small"
        type="number"
        label="この約定代金(円)以下"
        placeholder="上限なし"
        value={maxTradeValue ?? ""}
        onChange={(e) => setMaxTradeValue(e.target.value === "" ? null : Number(e.target.value))}
        onBlur={commit}
        sx={{ width: 220 }}
      />
      <TextField
        size="small"
        type="number"
        label="片道手数料(円)"
        value={commission}
        onChange={(e) => setCommission(Number(e.target.value))}
        onBlur={commit}
        sx={{ width: 160 }}
      />
      <IconButton size="small" onClick={() => deleteTier.mutate(tier.tierId)} aria-label="削除">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function TradingCostSettingsPanel() {
  const { data: taxRate } = useCapitalGainsTaxRate();
  const updateTaxRate = useUpdateCapitalGainsTaxRate();
  const [rateValue, setRateValue] = useState<number | null>(null);

  const { data: tiers, isLoading: tiersLoading } = useTradingFeeTiers();
  const createTier = useCreateTradingFeeTier();

  const displayRate = rateValue ?? taxRate?.rate ?? "";

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              譲渡益課税の税率
            </Typography>
            <Typography variant="body2" color="text.secondary">
              特定口座(源泉徴収あり)/一般口座の標準税率は20.315%です。NISA口座等、非課税の場合は0にしてください。
            </Typography>
          </Box>
          <TextField
            size="small"
            type="number"
            value={displayRate}
            onChange={(e) => setRateValue(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={() => {
              if (rateValue !== null && rateValue !== taxRate?.rate) {
                updateTaxRate.mutate(rateValue);
              }
            }}
            slotProps={{ htmlInput: { step: "any", min: 0, max: 100 } }}
            sx={{ width: 120 }}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              売買手数料(片道)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              約定代金の金額帯ごとの片道手数料です。初期値はSBI証券の現物取引「スタンダードプラン」を参考にした概算のため、
              実際に利用している証券会社・プランの最新の手数料表と照合して調整してください(SBI証券は条件を満たすと無料になる「ゼロ革命」等もあります)。
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => createTier.mutate({ maxTradeValue: 0, commission: 0 })}
            sx={{ flexShrink: 0 }}
          >
            ティア追加
          </Button>
        </Stack>

        {tiersLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {tiers?.map((tier) => (
              <FeeTierRow key={tier.tierId} tier={tier} />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
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

      <Alert severity="info" sx={{ mb: 2 }}>
        分類A(原則禁止)・分類B(理由なき場合回避)・分類C(条件次第)は、単純なAND/OR/NOTの指定機能ではありません。同じ分類内の複数条件は「いずれか1つでも該当すれば成立」というOR判定です。分類同士をどう組み合わせて最終判定にするかは、候補スクリーニング/買入タイミング/損切り判定/利確判定という用途ごとに異なる決め打ちのロジックになっています(詳細は各セクションの説明を参照してください)。
      </Alert>

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

      {tab === "technicalScore" && (
        <Stack spacing={2}>
          <TechnicalScoreThresholdSetting />
          <TechnicalScoreFormulaSettings />
        </Stack>
      )}
      {tab === "screeningRules" && <ScreeningRulesPanel />}
      {tab === "tradingCosts" && <TradingCostSettingsPanel />}
    </Box>
  );
}
