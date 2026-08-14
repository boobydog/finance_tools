"use client";

import { Box, Stack, Typography, LinearProgress, Divider } from "@mui/material";
import type { LossCutSignal, PositionAccountType, ProfitTakingSignal } from "@/types";
import {
  lossCutDrawdownPercent,
  lossCutScoreDiff,
  isTrailingStopTriggered,
  TARGET_PRICE_LOGIC_LABEL,
} from "@/lib/tradeSignals";

const ACCOUNT_TYPE_LABEL: Record<PositionAccountType, string> = {
  taxable: "特定口座(源泉徴収あり)/一般口座",
  nisa: "NISA口座",
  mixed: "特定/一般・NISA混在",
};

// 損切り・利確どちらの画面でも、直近の購入記録の口座種別に応じて税率・手数料を反映するか
// どうかを判断した「手数料・税引後の想定損益」を表示する(NISA口座は非課税・手数料無料)。
function NetProfitBlock({
  accountType,
  netProfit,
  buyCommission,
  sellCommission,
  estimatedTax,
}: {
  accountType: PositionAccountType | null;
  netProfit: number | null;
  buyCommission: number | null;
  sellCommission: number | null;
  estimatedTax: number | null;
}) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        手数料・税引後の想定損益{accountType ? `(${ACCOUNT_TYPE_LABEL[accountType]})` : ""}:{" "}
        {netProfit !== null ? (
          <Box component="span" sx={{ color: netProfit > 0 ? "success.main" : "error.main" }}>
            {netProfit > 0 ? "+" : ""}
            {netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}円
          </Box>
        ) : (
          "-"
        )}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        (売買手数料 買{buyCommission?.toLocaleString() ?? "-"}円 / 売{sellCommission?.toLocaleString() ?? "-"}円、
        譲渡益課税概算 {estimatedTax?.toLocaleString() ?? "-"}円)
      </Typography>
    </>
  );
}

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

// 損切り・利確判定画面の詳細ダイアログと、銘柄詳細画面(保有株のみ)の両方から
// 使う共通の判定内訳表示。
export function ExitJudgmentDetail({
  lossCut,
  profitTaking,
}: {
  lossCut?: LossCutSignal;
  profitTaking?: ProfitTakingSignal;
}) {
  if (!lossCut && !profitTaking) return null;

  return (
    <>
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
            <Divider sx={{ my: 1 }} />
            <NetProfitBlock
              accountType={lossCut.accountType}
              netProfit={lossCut.netProfit}
              buyCommission={lossCut.buyCommission}
              sellCommission={lossCut.sellCommission}
              estimatedTax={lossCut.estimatedTax}
            />
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
            <Typography
              variant="body2"
              sx={{ color: profitTaking.isHoldingPeriodExceeded ? "warning.main" : undefined }}
            >
              保有期間(第3の判定軸、損益に関わらず強制決済):{" "}
              {profitTaking.holdingPeriodExitDays === null
                ? "上限未設定"
                : `${profitTaking.holdingDays ?? "-"}日 / 上限${profitTaking.holdingPeriodExitDays}日${
                    profitTaking.isHoldingPeriodExceeded ? "(満了)" : ""
                  }`}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <NetProfitBlock
              accountType={profitTaking.accountType}
              netProfit={profitTaking.netProfit}
              buyCommission={profitTaking.buyCommission}
              sellCommission={profitTaking.sellCommission}
              estimatedTax={profitTaking.estimatedTax}
            />
          </Stack>
        </DetailSection>
      )}
    </>
  );
}
