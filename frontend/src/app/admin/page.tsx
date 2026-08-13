"use client";

import { Box, Typography, Paper } from "@mui/material";

// 管理専用画面のプレースホルダー。ENABLE_AUTH=true 時はproxy(旧middleware)により
// 未ログインの場合/loginへリダイレクトされる。
export default function AdminPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        管理者設定
      </Typography>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">
          タグ・スクリーニンググループのマスタ管理など、管理専用機能をここに追加していきます。
        </Typography>
      </Paper>
    </Box>
  );
}
