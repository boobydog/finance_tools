import { createTheme } from "@mui/material/styles";

// 投資ツールらしいダークモードをデフォルトに。
// 上昇=緑/アクセント青、下落=赤で統一する。
export const theme = createTheme({
  colorSchemes: { dark: true, light: true },
  cssVariables: { colorSchemeSelector: "class" },
  palette: {
    mode: "dark",
    primary: { main: "#3ea6ff" },
    success: { main: "#00c853" },
    error: { main: "#ff5252" },
    background: { default: "#0f1115", paper: "#171a21" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Hiragino Kaku Gothic ProN"',
      '"Noto Sans JP"',
      "sans-serif",
    ].join(","),
  },
});

export const priceColor = (changePercent: number | null): string => {
  if (changePercent === null) return "text.secondary";
  if (changePercent > 0) return "success.main";
  if (changePercent < 0) return "error.main";
  return "text.secondary";
};
