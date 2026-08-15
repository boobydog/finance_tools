"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Stack,
  MenuItem,
  Select,
  TextField,
  InputAdornment,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Pagination,
} from "@mui/material";
import type { GridPaginationModel } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import { useStocks, useEntrySignals, useLossCutSignals, useProfitTakingSignals } from "@/hooks/useStocks";
import { useLiveQuotes } from "@/hooks/useLiveQuote";
import { StockTable } from "@/components/stocks/StockTable";
import { StockCard } from "@/components/stocks/StockCard";
import { StickyActionBar } from "@/components/stocks/StickyActionBar";
import type { StockStatus } from "@/types";
import { classifyTrade } from "@/lib/tradeSignals";

const TABS: { value: StockStatus | "all"; label: string }[] = [
  { value: "all", label: "全銘柄" },
  { value: "interested", label: "候補" },
  { value: "holding", label: "保有中" },
  { value: "sold", label: "売却済" },
  { value: "excluded", label: "除外" },
];

type SortKey = "screeningScore" | "changePercent" | "name";

const SCORE_THRESHOLDS = [20, 40, 60, 80, 100];

// モバイルのカード表示は仮想化していないため、全銘柄(数千件)を一度に
// 描画するとブラウザが固まる。DataGridの既定ページサイズ(25件)に合わせて
// カード表示側もページネーションする。
const MOBILE_PAGE_SIZE = 25;

export default function StocksPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: stocks, isLoading } = useStocks();
  const { data: entrySignals } = useEntrySignals();
  const { data: lossCutSignals } = useLossCutSignals();
  const { data: profitTakingSignals } = useProfitTakingSignals();

  const [tab, setTab] = useState<StockStatus | "all">("all");
  const [sector, setSector] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("screeningScore");
  const [keyword, setKeyword] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const sectors = useMemo(
    () => Array.from(new Set((stocks ?? []).map((s) => s.sector).filter(Boolean))) as string[],
    [stocks]
  );

  const filtered = useMemo(() => {
    if (!stocks) return [];
    return stocks
      .filter((s) => {
        if (tab === "all") return true;
        // 「候補」タブは、複数回の買い増し・再エントリーの判断にも使えるよう、
        // 保有中・売却済の銘柄も合わせて表示する(「保有中」「売却済」タブとは重複表示になる)。
        if (tab === "interested") return s.status === "interested" || s.status === "holding" || s.status === "sold";
        return s.status === tab;
      })
      .filter((s) => sector === "all" || s.sector === sector)
      .filter((s) => minScore === "all" || (s.screeningScore ?? -Infinity) >= Number(minScore))
      .filter(
        (s) =>
          keyword.trim() === "" ||
          s.name.includes(keyword) ||
          s.tickerSymbol.includes(keyword)
      )
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name, "ja");
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        return bv - av;
      });
  }, [stocks, tab, sector, minScore, keyword, sortKey]);

  const selectedStock = filtered.find((s) => s.tickerSymbol === selectedSymbol) ?? null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / MOBILE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedForMobile = filtered.slice(
    (currentPage - 1) * MOBILE_PAGE_SIZE,
    currentPage * MOBILE_PAGE_SIZE
  );

  // 表示中の銘柄のみをライブ株価取得の対象にする(レート制限回避のため画面外は対象外)。
  const pagedForDesktop = filtered.slice(
    paginationModel.page * paginationModel.pageSize,
    (paginationModel.page + 1) * paginationModel.pageSize
  );
  const visibleTickers = (isMobile ? pagedForMobile : pagedForDesktop).map((s) => s.tickerSymbol);
  const { data: liveQuotes } = useLiveQuotes(visibleTickers);
  const liveQuoteByTicker = new Map((liveQuotes ?? []).map((q) => [q.tickerSymbol, q]));
  const entryByTicker = new Map((entrySignals ?? []).map((s) => [s.tickerSymbol, s]));
  const lossCutByTicker = new Map((lossCutSignals ?? []).map((s) => [s.tickerSymbol, s]));
  const profitTakingByTicker = new Map((profitTakingSignals ?? []).map((s) => [s.tickerSymbol, s]));
  const desktopRows = filtered.map((stock) => {
    const quote = liveQuoteByTicker.get(stock.tickerSymbol);
    const tradeVerdict = classifyTrade(
      entryByTicker.get(stock.tickerSymbol),
      lossCutByTicker.get(stock.tickerSymbol),
      profitTakingByTicker.get(stock.tickerSymbol)
    );
    return { ...stock, liveOpen: quote?.open, liveCurrentPrice: quote?.currentPrice, tradeVerdict };
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        銘柄管理
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {TABS.map((t) => (
          <Tab key={String(t.value)} value={t.value} label={t.label} />
        ))}
      </Tabs>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="銘柄名・コードで検索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ flex: 1 }}
        />
        <Select size="small" value={sector} onChange={(e) => setSector(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">業種: すべて</MenuItem>
          {sectors.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={minScore} onChange={(e) => setMinScore(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">スコア: すべて</MenuItem>
          {SCORE_THRESHOLDS.map((threshold) => (
            <MenuItem key={threshold} value={String(threshold)}>
              スコア {threshold}点以上
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} sx={{ minWidth: 160 }}>
          <MenuItem value="screeningScore">並び替え: 決算スコア</MenuItem>
          <MenuItem value="changePercent">並び替え: 騰落率</MenuItem>
          <MenuItem value="name">並び替え: 銘柄名</MenuItem>
        </Select>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : isMobile ? (
        <>
          <Stack spacing={1.5}>
            {pagedForMobile.map((stock) => (
              <StockCard
                key={stock.tickerSymbol}
                stock={stock}
                selected={selectedSymbol === stock.tickerSymbol}
                onSelect={() =>
                  setSelectedSymbol((current) =>
                    current === stock.tickerSymbol ? null : stock.tickerSymbol
                  )
                }
              />
            ))}
          </Stack>
          {pageCount > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_, value) => setPage(value)}
                size="small"
              />
            </Box>
          )}
        </>
      ) : (
        <StockTable
          stocks={desktopRows}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
        />
      )}

      {isMobile && selectedStock && (
        <StickyActionBar stock={selectedStock} onClose={() => setSelectedSymbol(null)} />
      )}
    </Box>
  );
}
