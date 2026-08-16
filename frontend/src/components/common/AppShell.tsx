"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TuneIcon from "@mui/icons-material/Tune";
import BoltIcon from "@mui/icons-material/Bolt";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { MarketStatusChip } from "./MarketStatusChip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ダッシュボード", icon: DashboardIcon },
  { href: "/stocks", label: "銘柄管理", icon: ShowChartIcon },
  { href: "/entry-monitor", label: "買入タイミング判定", icon: BoltIcon },
  { href: "/exit-monitor", label: "損切り・利確判定", icon: SwapVertIcon },
  { href: "/settings/rules", label: "判定基準設定", icon: TuneIcon },
];

const DRAWER_WIDTH = 240;

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  // サーバーにはwindow.matchMediaが無くuseMediaQueryは常にfalseを返すため、
  // hydration直後(mounted=falseの間)はサーバーと同じfalseを使い、mount後に
  // 実際のビューポート幅で再評価する(hydrationミスマッチを避けるため)。
  const isMobileQuery = useMediaQuery(theme.breakpoints.down("sm"));
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = mounted && isMobileQuery;

  const drawerContent = (
    <List>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <ListItemButton
          key={href}
          component={Link}
          href={href}
          selected={pathname === href || pathname.startsWith(`${href}/`)}
          onClick={() => setMobileOpen(false)}
        >
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, backgroundColor: "background.paper" }}
        elevation={0}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            株式投資支援システム
          </Typography>
          <MarketStatusChip />
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          // モバイルはSticky Action Bar分の余白を確保
          pb: { xs: 10, sm: 3 },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
