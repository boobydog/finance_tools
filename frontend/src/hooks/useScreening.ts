import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScreeningGroup,
  createScreeningRule,
  deleteScreeningGroup,
  deleteScreeningRule,
  exportScreeningRules,
  fetchScreeningGroups,
  fetchScreeningParamDefinitions,
  fetchTechnicalScoreThreshold,
  fetchTradeHistory,
  importScreeningRules,
  updateScreeningGroup,
  updateScreeningGroupActive,
  updateScreeningGroupCandidateActive,
  updateScreeningRule,
  updateTechnicalScoreThreshold,
} from "@/lib/api";
import type {
  CreateScreeningRuleRequest,
  ScreeningRulesExport,
  UpsertScreeningGroupRequest,
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
