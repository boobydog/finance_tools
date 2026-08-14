// 買入タイミング判定・損切り判定・利確判定の各画面で共通して使う表示用ヘルパー。
// 判定そのもの(有力候補/優先度A・B/利確要否)は、銘柄が所属するスクリーニンググループ
// (なければデフォルトグループ)の基準に基づきサーバー側(trade_judgment_engine)で
// 評価済みであり、EntrySignal.isStrongCandidate / LossCutSignal.priority /
// ProfitTakingSignal.shouldTakeProfit をそのまま使う。ここでは金額・率の表示計算のみを行う。

import type { EntrySignal, LossCutSignal, ProfitTakingSignal, EffectiveTargetPriceLogic } from "@/types";

export const TARGET_PRICE_LOGIC_LABEL: Record<EffectiveTargetPriceLogic, string> = {
  manual: "手動設定",
  eps_growth: "EPS成長率ベース",
  pbr_normalization: "PBR正常化ベース",
  analyst_consensus: "アナリストコンセンサス",
};

export function lossCutDrawdownPercent(row: LossCutSignal): number | null {
  if (row.currentPrice === null || row.purchasePrice === null || row.purchasePrice === 0) return null;
  return ((row.currentPrice - row.purchasePrice) / row.purchasePrice) * 100;
}

export function lossCutScoreDiff(row: LossCutSignal): number | null {
  if (row.currentScore === null || row.purchaseScore === null) return null;
  return row.currentScore - row.purchaseScore;
}

export function isTrailingStopTriggered(row: ProfitTakingSignal): boolean | null {
  if (row.currentPrice === null || row.trailingStopTriggerPrice === null) return null;
  return row.currentPrice <= row.trailingStopTriggerPrice;
}

// --- 統合判定(銘柄管理一覧・詳細画面向け) ---
export type TradeAction = "buy" | "loss_cut_a" | "loss_cut_b" | "holding_period_exit" | "profit_taking";

export interface TradeVerdict {
  action: TradeAction;
  label: string;
  color: "success" | "error" | "warning";
}

export function classifyTrade(
  entry?: EntrySignal | null,
  lossCut?: LossCutSignal | null,
  profitTaking?: ProfitTakingSignal | null
): TradeVerdict | null {
  if (lossCut?.priority === "A") return { action: "loss_cut_a", label: "即時売却", color: "error" };
  if (lossCut?.priority === "B") return { action: "loss_cut_b", label: "回避・撤退検討", color: "warning" };
  // 保有期間満了は損益に関わらず機械的に決済する第3の判定軸のため、純損益ゲート対象の
  // shouldTakeProfitとは独立に判定する(利確シグナルより優先)。
  if (profitTaking?.isHoldingPeriodExceeded) {
    return { action: "holding_period_exit", label: "保有期間満了", color: "warning" };
  }
  if (profitTaking?.shouldTakeProfit) {
    return { action: "profit_taking", label: "利確", color: "success" };
  }
  if (entry?.isStrongCandidate) {
    return { action: "buy", label: "買い候補", color: "success" };
  }
  return null;
}

// 損切り・利確判定画面向け: 統合判定(TradeVerdict)の根拠を1行の要約テキストにする。
// サーバー側は優先度/要否のフラグのみを返すため、具体的にどの条件が該当したかは
// (現状の標準的な項目構成を前提に)ここで表示用として再構成する。
export function exitReason(
  verdict: TradeVerdict | null,
  lossCut?: LossCutSignal | null,
  profitTaking?: ProfitTakingSignal | null
): string {
  if (verdict?.action === "loss_cut_a" && lossCut) {
    if (lossCut.isDelistingRisk) return "上場廃止リスク";
    if (lossCut.isUnderSupervision) return "監理銘柄指定";
    const drawdown = lossCutDrawdownPercent(lossCut);
    if (drawdown !== null) return `下落率${drawdown.toFixed(1)}%`;
  }
  if (verdict?.action === "loss_cut_b" && lossCut) {
    if (lossCut.operatingProfitYoy !== null && lossCut.operatingProfitYoy < 0) {
      return `営業利益前期比${lossCut.operatingProfitYoy.toFixed(1)}%`;
    }
    if (lossCut.epsGrowth !== null && lossCut.epsGrowth < 0) return `EPS成長率${lossCut.epsGrowth.toFixed(1)}%`;
    const diff = lossCutScoreDiff(lossCut);
    if (diff !== null) return `スコア${diff > 0 ? "+" : ""}${diff.toFixed(0)}pt`;
  }
  if (verdict?.action === "holding_period_exit" && profitTaking) {
    if (profitTaking.holdingDays !== null && profitTaking.holdingPeriodExitDays !== null) {
      return `保有${profitTaking.holdingDays}日(上限${profitTaking.holdingPeriodExitDays}日)`;
    }
  }
  if (verdict?.action === "profit_taking" && profitTaking) {
    if (profitTaking.achievementPercent !== null && profitTaking.achievementPercent >= 100) {
      return `目標達成度${profitTaking.achievementPercent.toFixed(0)}%`;
    }
    if (isTrailingStopTriggered(profitTaking)) return "トレイリングストップ発動";
    if (profitTaking.forwardPer !== null) return `PER${profitTaking.forwardPer.toFixed(1)}倍(過熱)`;
  }
  return "-";
}
