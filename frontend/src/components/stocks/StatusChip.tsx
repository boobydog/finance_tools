import { Chip } from "@mui/material";
import type { StockStatus } from "@/types";

const STATUS_LABEL: Record<NonNullable<StockStatus>, string> = {
  interested: "候補",
  considering: "検討",
  holding: "保有中",
  sold: "売却済",
  excluded: "除外",
};

const STATUS_COLOR: Record<NonNullable<StockStatus>, "info" | "success" | "default" | "error" | "warning"> = {
  interested: "info",
  considering: "warning",
  holding: "success",
  sold: "default",
  excluded: "error",
};

export function StatusChip({ status }: { status: StockStatus }) {
  if (!status) {
    return <Chip label="未設定" size="small" variant="outlined" />;
  }
  return <Chip label={STATUS_LABEL[status]} color={STATUS_COLOR[status]} size="small" />;
}
