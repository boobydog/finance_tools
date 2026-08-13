"use client";

import { Card, CardActionArea, Box, Typography, Stack, Chip } from "@mui/material";
import Link from "next/link";
import type { StockWithStatus } from "@/types";
import { StatusChip } from "./StatusChip";
import { priceColor } from "@/lib/theme";

export function StockCard({
  stock,
  selected,
  onSelect,
}: {
  stock: StockWithStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1,
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1.5 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography
              component={Link}
              href={`/stocks/${stock.tickerSymbol}`}
              onClick={(e) => e.stopPropagation()}
              variant="subtitle1"
              sx={{ fontWeight: 600, "&:hover": { textDecoration: "underline" } }}
            >
              {stock.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stock.tickerSymbol} ・ {stock.sector ?? "-"}
            </Typography>
          </Box>
          <StatusChip status={stock.status} />
        </Stack>

        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mt: 1.5 }}
        >
          <Box>
            <Typography variant="h6">
              {stock.latestClose?.toLocaleString() ?? "-"}
            </Typography>
            <Typography variant="body2" sx={{ color: priceColor(stock.changePercent) }}>
              {stock.changePercent !== null
                ? `${stock.changePercent > 0 ? "+" : ""}${stock.changePercent}%`
                : "-"}
            </Typography>
          </Box>
          {stock.screeningScore !== null && (
            <Chip label={`スコア ${stock.screeningScore}`} size="small" color="primary" variant="outlined" />
          )}
        </Stack>

        {stock.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
            {stock.tags.map((tag) => (
              <Chip
                key={tag.tagId}
                label={tag.name}
                size="small"
                sx={{ backgroundColor: tag.color, color: "#0f1115" }}
              />
            ))}
          </Stack>
        )}
      </CardActionArea>
    </Card>
  );
}
