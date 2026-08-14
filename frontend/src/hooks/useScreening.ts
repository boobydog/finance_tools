import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScreeningGroup,
  createScreeningRule,
  createTradingFeeTier,
  deleteScreeningGroup,
  deleteScreeningRule,
  deleteTradingFeeTier,
  exportScreeningRules,
  fetchCapitalGainsTaxRate,
  fetchScreeningGroups,
  fetchScreeningParamDefinitions,
  fetchTechnicalScoreConfig,
  fetchTechnicalScoreThreshold,
  fetchTradeHistory,
  fetchTradingFeeTiers,
  importScreeningRules,
  updateCapitalGainsTaxRate,
  updateScreeningGroup,
  updateScreeningGroupActive,
  updateScreeningGroupCandidateActive,
  updateScreeningRule,
  updateTechnicalScoreConfig,
  updateTechnicalScoreThreshold,
  updateTradingFeeTier,
} from "@/lib/api";
import type {
  CreateScreeningRuleRequest,
  ScreeningRulesExport,
  TechnicalScoreConfig,
  UpsertScreeningGroupRequest,
  UpsertTradingFeeTierRequest,
} from "@/types";

export const screeningGroupsQueryKey = ["screeningGroups"] as const;

export function useScreeningGroups() {
  return useQuery({ queryKey: screeningGroupsQueryKey, queryFn: fetchScreeningGroups });
}

export function useScreeningParamDefinitions() {
  return useQuery({
    queryKey: ["screeningParamDefinitions"],
    queryFn: fetchScreeningParamDefinitions,
  });
}

export function useTradeHistory(tickerSymbol?: string) {
  return useQuery({
    queryKey: ["tradeHistory", tickerSymbol ?? "all"],
    queryFn: () => fetchTradeHistory(tickerSymbol),
  });
}

function useInvalidateScreeningGroups() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: screeningGroupsQueryKey });
}

export function useCreateScreeningGroup() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: (body: UpsertScreeningGroupRequest) => createScreeningGroup(body),
    onSuccess: invalidate,
  });
}

export function useUpdateScreeningGroup() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: number; body: UpsertScreeningGroupRequest }) =>
      updateScreeningGroup(groupId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateScreeningGroupActive() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: ({ groupId, isActive }: { groupId: number; isActive: boolean }) =>
      updateScreeningGroupActive(groupId, isActive),
    onSuccess: invalidate,
  });
}

export function useUpdateScreeningGroupCandidateActive() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: ({ groupId, candidateScreeningActive }: { groupId: number; candidateScreeningActive: boolean }) =>
      updateScreeningGroupCandidateActive(groupId, candidateScreeningActive),
    onSuccess: invalidate,
  });
}

export function useDeleteScreeningGroup() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: (groupId: number) => deleteScreeningGroup(groupId),
    onSuccess: invalidate,
  });
}

export function useCreateScreeningRule() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: number; body: CreateScreeningRuleRequest }) =>
      createScreeningRule(groupId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateScreeningRule() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: number; body: CreateScreeningRuleRequest }) =>
      updateScreeningRule(ruleId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteScreeningRule() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: (ruleId: number) => deleteScreeningRule(ruleId),
    onSuccess: invalidate,
  });
}

export function useImportScreeningRules() {
  const invalidate = useInvalidateScreeningGroups();
  return useMutation({
    mutationFn: (body: ScreeningRulesExport) => importScreeningRules(body),
    onSuccess: invalidate,
  });
}

export function useExportScreeningRulesMutation() {
  return useMutation({ mutationFn: () => exportScreeningRules() });
}

export function useTechnicalScoreThreshold() {
  return useQuery({
    queryKey: ["technicalScoreThreshold"],
    queryFn: fetchTechnicalScoreThreshold,
  });
}

export function useUpdateTechnicalScoreThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threshold: number) => updateTechnicalScoreThreshold(threshold),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["technicalScoreThreshold"] }),
  });
}

export function useTechnicalScoreConfig() {
  return useQuery({
    queryKey: ["technicalScoreConfig"],
    queryFn: fetchTechnicalScoreConfig,
  });
}

export function useUpdateTechnicalScoreConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: TechnicalScoreConfig) => updateTechnicalScoreConfig(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["technicalScoreConfig"] }),
  });
}

export function useCapitalGainsTaxRate() {
  return useQuery({
    queryKey: ["capitalGainsTaxRate"],
    queryFn: fetchCapitalGainsTaxRate,
  });
}

export function useUpdateCapitalGainsTaxRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rate: number) => updateCapitalGainsTaxRate(rate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capitalGainsTaxRate"] }),
  });
}

export const tradingFeeTiersQueryKey = ["tradingFeeTiers"] as const;

export function useTradingFeeTiers() {
  return useQuery({ queryKey: tradingFeeTiersQueryKey, queryFn: fetchTradingFeeTiers });
}

function useInvalidateTradingFeeTiers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tradingFeeTiersQueryKey });
}

export function useCreateTradingFeeTier() {
  const invalidate = useInvalidateTradingFeeTiers();
  return useMutation({
    mutationFn: (body: UpsertTradingFeeTierRequest) => createTradingFeeTier(body),
    onSuccess: invalidate,
  });
}

export function useUpdateTradingFeeTier() {
  const invalidate = useInvalidateTradingFeeTiers();
  return useMutation({
    mutationFn: ({ tierId, body }: { tierId: number; body: UpsertTradingFeeTierRequest }) =>
      updateTradingFeeTier(tierId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTradingFeeTier() {
  const invalidate = useInvalidateTradingFeeTiers();
  return useMutation({
    mutationFn: (tierId: number) => deleteTradingFeeTier(tierId),
    onSuccess: invalidate,
  });
}
