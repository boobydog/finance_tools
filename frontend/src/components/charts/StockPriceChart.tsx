"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme, Stack, FormControlLabel, Checkbox } from "@mui/material";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from "recharts";
import type { PricePoint } from "@/types";

const MA_PERIODS = [5, 25, 75] as const;
const MA_COLORS: Record<number, string> = {
  5: "#ffb74d",
  25: "#3ea6ff",
  75: "#ba68c8",
};

// 表示/非表示の選択はブラウザを開いている間だけ保持する(タブ・ウィンドウを閉じるとリセット)。
const MA_VISIBILITY_STORAGE_KEY = "stockPriceChart.visibleMa";
const DEFAULT_VISIBLE_MA: Record<number, boolean> = { 5: true, 25: true, 75: true };

function loadStoredVisibleMa(): Record<number, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MA_VISIBILITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveVisibleMa(visibleMa: Record<number, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MA_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleMa));
  } catch {
    // sessionStorageが使えない環境(プライベートモード等)では保存をあきらめる。
  }
}

type ChartRow = PricePoint & {
  range: [number, number];
  movingAverages: Record<number, number | null>;
};

function withMovingAverages(data: PricePoint[], periods: readonly number[]): ChartRow[] {
  return data.map((point, index) => {
    const movingAverages: Record<number, number | null> = {};
    for (const period of periods) {
      if (index + 1 < period) {
        movingAverages[period] = null;
        continue;
      }
      const window = data.slice(index + 1 - period, index + 1);
      const sum = window.reduce((acc, p) => acc + p.close, 0);
      movingAverages[period] = Math.round((sum / period) * 100) / 100;
    }
    return {
      ...point,
      range: [point.low ?? point.close, point.high ?? point.close],
      movingAverages,
    };
  });
}

// [low, high]の範囲バーとして描画されるBarのshapeを、実際のOHLCに基づく
// ローソク足(ヒゲ+実体)として描き直す。x/y/height はrange([low,high])に対応するピクセル値。
function makeCandleShape(upColor: string, downColor: string) {
  return function CandleShape(props: unknown) {
    const { x, y, width, height, payload } = props as {
      x: number;
      y: number;
      width: number;
      height: number;
      payload: ChartRow;
    };
    const { open, close, high, low } = payload;
    if (open == null || close == null || high == null || low == null || high === low) return null;

    const pxPerUnit = height / (high - low);
    const openY = y + (high - open) * pxPerUnit;
    const closeY = y + (high - close) * pxPerUnit;
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
    const isUp = close >= open;
    const color = isUp ? upColor : downColor;
    const centerX = x + width / 2;
    const bodyWidth = Math.max(width * 0.7, 2);

    return (
      <g>
        <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
        <rect
          x={centerX - bodyWidth / 2}
          y={bodyTop}
          width={bodyWidth}
          height={bodyHeight}
          fill={isUp ? color : color}
          fillOpacity={isUp ? 0.15 : 1}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    );
  };
}

export function StockPriceChart({ data }: { data: PricePoint[] }) {
  const theme = useTheme();
  const [visibleMa, setVisibleMa] = useState<Record<number, boolean>>(DEFAULT_VISIBLE_MA);

  // サーバー/クライアントの初回レンダリングを一致させるため、既定値でマウントしてから
  // sessionStorageの保存値をuseEffectで反映する(hydrationミスマッチ回避)。
  useEffect(() => {
    const stored = loadStoredVisibleMa();
    if (stored) setVisibleMa(stored);
  }, []);

  const toggleMa = (period: number, checked: boolean) => {
    setVisibleMa((prev) => {
      const next = { ...prev, [period]: checked };
      saveVisibleMa(next);
      return next;
    });
  };

  const rows = useMemo(() => withMovingAverages(data, MA_PERIODS), [data]);
  const CandleShape = useMemo(
    () => makeCandleShape(theme.palette.error.main, theme.palette.success.main),
    [theme]
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        {MA_PERIODS.map((period) => (
          <FormControlLabel
            key={period}
            control={
              <Checkbox
                size="small"
                checked={visibleMa[period] ?? false}
                onChange={(e) => toggleMa(period, e.target.checked)}
                sx={{ color: MA_COLORS[period], "&.Mui-checked": { color: MA_COLORS[period] } }}
              />
            }
            label={`MA${period}`}
          />
        ))}
      </Stack>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            minTickGap={40}
          />
          <YAxis
            yAxisId="price"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            width={70}
          />
          <YAxis yAxisId="volume" orientation="right" hide />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Bar yAxisId="volume" dataKey="volume" fill={theme.palette.primary.main} opacity={0.15} />
          <Bar yAxisId="price" dataKey="range" shape={CandleShape} isAnimationActive={false} />
          {MA_PERIODS.filter((period) => visibleMa[period]).map((period) => (
            <Line
              key={period}
              yAxisId="price"
              type="monotone"
              dataKey={`movingAverages.${period}`}
              stroke={MA_COLORS[period]}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          ))}
          <Brush
            dataKey="date"
            height={28}
            travellerWidth={10}
            stroke={theme.palette.primary.main}
            fill={theme.palette.background.default}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Stack>
  );
}
