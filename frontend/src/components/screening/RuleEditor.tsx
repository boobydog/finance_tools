"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Button,
  Chip,
  Typography,
  Switch,
  FormControlLabel,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import LockIcon from "@mui/icons-material/Lock";
import type {
  ScreeningCategory,
  ScreeningGroup,
  ScreeningParamDefinition,
  ScreeningRule,
  RuleOperator,
  RulePurpose,
  RuleValueMode,
} from "@/types";
import {
  useCreateScreeningRule,
  useDeleteScreeningGroup,
  useDeleteScreeningRule,
  useUpdateScreeningGroup,
  useUpdateScreeningGroupActive,
  useUpdateScreeningGroupCandidateActive,
  useUpdateScreeningRule,
} from "@/hooks/useScreening";

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: "gte", label: "以上" },
  { value: "lte", label: "以下" },
  { value: "eq", label: "等しい" },
];

const VALUE_MODE_OPTIONS: { value: RuleValueMode; label: string }[] = [
  { value: "fixed", label: "固定値" },
  { value: "hv_multiplier", label: "HV倍率" },
];

const CATEGORY_META: Record<ScreeningCategory, { label: string; color: "error" | "warning" | "info" }> = {
  A: { label: "分類A(原則禁止)", color: "error" },
  B: { label: "分類B(理由なき場合回避)", color: "warning" },
  C: { label: "分類C(条件次第)", color: "info" },
};

const SECTION_META: Record<RulePurpose, { label: string; description: string; categories: ScreeningCategory[] }> = {
  candidate: {
    label: "候補スクリーニング",
    description: "未設定の銘柄を自動で「候補」として反映する基準。",
    categories: ["A", "B", "C"],
  },
  entry_timing: {
    label: "買入タイミング",
    description:
      "候補銘柄の買入シグナル(分類C)。満たした数がしきい値以上で有力候補。分類Aに該当する場合は除外(例: スコアが低すぎる銘柄の足切り)。",
    categories: ["A", "C"],
  },
  loss_cut: {
    label: "損切り判定",
    description: "分類Aで即時売却、分類Bで回避・撤退検討と判定します。",
    categories: ["A", "B"],
  },
  profit_taking: {
    label: "利確判定",
    description: "分類Aのいずれかを満たせば売却検討と判定します。",
    categories: ["A"],
  },
};

const SECTION_ORDER: RulePurpose[] = ["candidate", "entry_timing", "loss_cut", "profit_taking"];

function validateValue(
  definition: ScreeningParamDefinition | undefined,
  value: number | null
): string | null {
  if (!definition || definition.valueType !== "number" || value === null) return null;
  if (definition.minValue !== null && value < definition.minValue) {
    return `${definition.minValue}以上で入力してください`;
  }
  if (definition.maxValue !== null && value > definition.maxValue) {
    return `${definition.maxValue}以下で入力してください`;
  }
  return null;
}

function RuleRow({
  rule,
  paramDefinitions,
}: {
  rule: ScreeningRule;
  paramDefinitions: ScreeningParamDefinition[];
}) {
  const updateRule = useUpdateScreeningRule();
  const deleteRule = useDeleteScreeningRule();
  const [value, setValue] = useState<number | null>(rule.paramValue);

  const isHvMultiplier = rule.valueMode === "hv_multiplier";
  const definition = paramDefinitions.find((d) => d.paramKey === rule.paramKey);
  // HV倍率モードでは、値はパラメータ本来の単位ではなく倍率(実際の閾値=倍率×銘柄のHV)
  // なので、パラメータ定義のmin/maxバリデーションは適用しない。
  const error = isHvMultiplier ? null : validateValue(definition, value);

  const commit = (patch: Partial<ScreeningRule>) => {
    updateRule.mutate({
      ruleId: rule.ruleId,
      body: {
        rulePurpose: rule.rulePurpose,
        category: rule.category,
        paramKey: rule.paramKey,
        operator: rule.operator,
        valueMode: rule.valueMode,
        paramValue: value,
        ...patch,
      },
    });
  };

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ alignItems: { sm: "flex-start" } }}
    >
      <Chip
        label={CATEGORY_META[rule.category].label}
        color={CATEGORY_META[rule.category].color}
        size="small"
        sx={{ minWidth: 170, mt: { sm: 1 } }}
      />
      <Select
        size="small"
        value={rule.paramKey}
        onChange={(e) => commit({ paramKey: e.target.value })}
        sx={{ minWidth: 200 }}
      >
        {paramDefinitions.map((d) => (
          <MenuItem key={d.paramKey} value={d.paramKey}>
            {d.label}
            {d.unit ? `(${d.unit})` : ""}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        value={rule.operator}
        onChange={(e) => commit({ operator: e.target.value as RuleOperator })}
        sx={{ minWidth: 110 }}
      >
        {OPERATOR_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        value={rule.valueMode}
        onChange={(e) => commit({ valueMode: e.target.value as RuleValueMode })}
        sx={{ minWidth: 110 }}
      >
        {VALUE_MODE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      <TextField
        size="small"
        type="number"
        value={value ?? ""}
        error={Boolean(error)}
        helperText={
          error ??
          (isHvMultiplier
            ? "銘柄のHVへの倍率(例: -0.5 → 閾値=-0.5×HV)"
            : definition?.minValue != null
              ? `${definition.minValue}〜${definition.maxValue}${definition.unit ?? ""}`
              : " ")
        }
        onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
        onBlur={() => {
          if (!error) commit({});
        }}
        sx={{ width: 200 }}
        slotProps={{ htmlInput: { step: "any" } }}
      />
      <IconButton size="small" onClick={() => deleteRule.mutate(rule.ruleId)} aria-label="削除" sx={{ mt: { sm: 0.5 } }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function RulePurposeSection({
  group,
  purpose,
  rules,
  paramDefinitions,
  extraHeader,
}: {
  group: ScreeningGroup;
  purpose: RulePurpose;
  rules: ScreeningRule[];
  paramDefinitions: ScreeningParamDefinition[];
  extraHeader?: React.ReactNode;
}) {
  const createRule = useCreateScreeningRule();
  const meta = SECTION_META[purpose];

  const addRule = (category: ScreeningCategory) => {
    if (paramDefinitions.length === 0) return;
    createRule.mutate({
      groupId: group.groupId,
      body: {
        rulePurpose: purpose,
        category,
        paramKey: paramDefinitions[0].paramKey,
        operator: "gte",
        valueMode: "fixed",
        paramValue: 0,
      },
    });
  };

  return (
    <Accordion
      variant="outlined"
      defaultExpanded={purpose === "candidate"}
      disableGutters
      sx={{ mb: 1, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", width: "100%" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {meta.label}
          </Typography>
          <Chip label={`${rules.length}件`} size="small" variant="outlined" />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          {meta.description}
        </Typography>

        {extraHeader}

        <Stack spacing={1.5}>
          {rules.map((rule) => (
            <RuleRow key={rule.ruleId} rule={rule} paramDefinitions={paramDefinitions} />
          ))}
        </Stack>
        {rules.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            条件が登録されていません。下のボタンから追加してください。
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {meta.categories.map((category) => (
            <Button
              key={category}
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addRule(category)}
              disabled={paramDefinitions.length === 0}
            >
              {CATEGORY_META[category].label}を追加
            </Button>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function RuleEditor({
  group,
  paramDefinitions,
}: {
  group: ScreeningGroup;
  paramDefinitions: ScreeningParamDefinition[];
}) {
  const updateGroup = useUpdateScreeningGroup();
  const updateGroupActive = useUpdateScreeningGroupActive();
  const updateCandidateActive = useUpdateScreeningGroupCandidateActive();
  const deleteGroup = useDeleteScreeningGroup();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [signalCountThreshold, setSignalCountThreshold] = useState<number | null>(group.signalCountThreshold);

  const commitGroup = (patch: Partial<{ name: string; description: string; signalCountThreshold: number | null }>) => {
    updateGroup.mutate({
      groupId: group.groupId,
      body: {
        name,
        description,
        signalCountThreshold,
        ...patch,
      },
    });
  };

  const rulesByPurpose: Record<RulePurpose, ScreeningRule[]> = {
    candidate: [],
    entry_timing: [],
    loss_cut: [],
    profit_taking: [],
  };
  for (const rule of group.rules) {
    rulesByPurpose[rule.rulePurpose].push(rule);
  }

  return (
    <Accordion
      variant="outlined"
      defaultExpanded={false}
      disableGutters
      sx={{ opacity: group.isActive ? 1 : 0.5, transition: "opacity 0.2s", "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", width: "100%", flexWrap: "wrap" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {group.name}
          </Typography>
          {group.isDefault && (
            <Chip icon={<LockIcon fontSize="small" />} label="デフォルト" size="small" color="default" />
          )}
          {!group.isActive && <Chip label="無効" size="small" />}
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {group.description}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2, gap: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack spacing={1} sx={{ flex: 1 }}>
            <TextField
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== group.name) commitGroup({});
              }}
              label="グループ名"
              sx={{ maxWidth: 320 }}
            />
            <TextField
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (group.description ?? "")) commitGroup({});
              }}
              label="説明"
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={group.isActive}
                  onChange={(e) =>
                    updateGroupActive.mutate({ groupId: group.groupId, isActive: e.target.checked })
                  }
                />
              }
              label={group.isActive ? "有効" : "無効"}
              sx={{ mr: 0 }}
            />
            <IconButton
              size="small"
              onClick={() => deleteGroup.mutate(group.groupId)}
              aria-label="グループ削除"
              disabled={group.isDefault}
              title={group.isDefault ? "デフォルトグループは削除できません" : "グループ削除"}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {SECTION_ORDER.map((purpose) => (
          <RulePurposeSection
            key={purpose}
            group={group}
            purpose={purpose}
            rules={rulesByPurpose[purpose]}
            paramDefinitions={paramDefinitions}
            extraHeader={
              purpose === "candidate" && group.isDefault ? (
                <FormControlLabel
                  sx={{ mb: 1.5 }}
                  control={
                    <Switch
                      size="small"
                      checked={group.candidateScreeningActive}
                      onChange={(e) =>
                        updateCandidateActive.mutate({
                          groupId: group.groupId,
                          candidateScreeningActive: e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    group.candidateScreeningActive
                      ? "候補スクリーニング有効(デフォルト基準でも自動候補化します)"
                      : "候補スクリーニング無効(自動候補化には使いません)"
                  }
                />
              ) : purpose === "entry_timing" ? (
                <Box sx={{ mb: 1.5 }}>
                  <TextField
                    size="small"
                    type="number"
                    label="有力候補と判定するシグナル数"
                    value={signalCountThreshold ?? ""}
                    onChange={(e) =>
                      setSignalCountThreshold(e.target.value === "" ? null : Number(e.target.value))
                    }
                    onBlur={() => {
                      if (signalCountThreshold !== group.signalCountThreshold) commitGroup({});
                    }}
                    slotProps={{ htmlInput: { step: 1, min: 0 } }}
                    sx={{ width: 260 }}
                  />
                </Box>
              ) : undefined
            }
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}
