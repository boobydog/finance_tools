"use client";

import { useEffect, useState } from "react";
import { Chip } from "@mui/material";
import { isTseMarketOpen } from "@/lib/marketHours";

// 取引時間の境界(9:00/11:30/12:30/15:30)をまたいでも表示が追従するよう、
// 1分ごとに再評価する。
const CHECK_INTERVAL_MS = 60_000;

export function MarketStatusChip() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOpen(isTseMarketOpen());
    const timer = window.setInterval(() => setIsOpen(isTseMarketOpen()), CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (isOpen === null) return null;

  return (
    <Chip
      size="small"
      label={isOpen ? "東証 取引時間中" : "東証 取引時間外"}
      color={isOpen ? "success" : "default"}
      variant={isOpen ? "filled" : "outlined"}
    />
  );
}
