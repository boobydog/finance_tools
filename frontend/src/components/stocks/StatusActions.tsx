"use client";

import { useState } from "react";
import { ButtonGroup, Button } from "@mui/material";
import type { StockStatus } from "@/types";
import { useUpdateStockStatus } from "@/hooks/useStocks";
import { TradeDialog } from "./TradeDialog";

// 「候補」「除外」は単なるフラグ変更のため即時更新する。
// 「購入」「売却」は実際の売買を表すため、TradeDialogで価格・数量・根拠(スクリーニング
// グループ)・メモを入力させ、trade_historyへの記録とセットで反映する。
type ActionDef =
  | { kind: "direct"; status: StockStatus; label: string }
  | { kind: "trade"; status: StockStatus; action: "buy" | "sell"; label: string };

const ACTIONS: ActionDef[] = [
  { kind: "direct", status: "interested", label: "候補" },
  { kind: "trade", status: "holding", action: "buy", label: "購入" },
  { kind: "trade", status: "sold", action: "sell", label: "売却" },
  { kind: "direct", status: "excluded", label: "除外" },
];

export function StatusActions({
  tickerSymbol,
  stockName,
  currentStatus,
  currentPrice,
  size = "medium",
  fullWidth = false,
}: {
  tickerSymbol: string;
  stockName: string;
  currentStatus: StockStatus;
  currentPrice?: number | null;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}) {
  const { mutate, isPending } = useUpdateStockStatus();
  const [tradeDialogAction, setTradeDialogAction] = useState<"buy" | "sell" | null>(null);

  return (
    <>
      <ButtonGroup size={size} fullWidth={fullWidth} disabled={isPending}>
        {ACTIONS.map((def) => (
          <Button
            key={def.status}
            variant={currentStatus === def.status ? "contained" : "outlined"}
            onClick={() =>
              def.kind === "direct"
                ? mutate({ tickerSymbol, status: def.status })
                : setTradeDialogAction(def.action)
            }
          >
            {def.label}
          </Button>
        ))}
      </ButtonGroup>

      {tradeDialogAction && (
        <TradeDialog
          open
          onClose={() => setTradeDialogAction(null)}
          tickerSymbol={tickerSymbol}
          stockName={stockName}
          action={tradeDialogAction}
          currentPrice={currentPrice}
        />
      )}
    </>
  );
}
