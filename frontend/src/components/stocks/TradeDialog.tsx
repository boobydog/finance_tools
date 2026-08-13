"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Select,
  MenuItem,
  Button,
  InputLabel,
  FormControl,
} from "@mui/material";
import { useCreateTrade } from "@/hooks/useStocks";
import { useScreeningGroups } from "@/hooks/useScreening";

// 「どの条件(スクリーニンググループ)の時に売買したか」の根拠とメモをtrade_historyへ
// 保存するため、購入/売却時にこのダイアログで価格・数量・根拠・メモを入力させる。
export function TradeDialog({
  open,
  onClose,
  tickerSymbol,
  stockName,
  action,
}: {
  open: boolean;
  onClose: () => void;
  tickerSymbol: string;
  stockName: string;
  action: "buy" | "sell";
}) {
  const { data: groups } = useScreeningGroups();
  const createTrade = useCreateTrade();

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [screeningGroupId, setScreeningGroupId] = useState(""); // "" = 指定なし、それ以外はgroupIdの文字列表現
  const [memo, setMemo] = useState("");

  const canSubmit = price !== "" && quantity !== "" && Number(price) > 0 && Number(quantity) > 0;

  const handleSubmit = () => {
    createTrade.mutate(
      {
        tickerSymbol,
        body: {
          action,
          price: Number(price),
          quantity: Number(quantity),
          screeningGroupId: screeningGroupId === "" ? null : Number(screeningGroupId),
          memo: memo.trim() === "" ? null : memo,
        },
      },
      {
        onSuccess: () => {
          setPrice("");
          setQuantity("");
          setScreeningGroupId("");
          setMemo("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {action === "buy" ? "購入" : "売却"}記録: {stockName}({tickerSymbol})
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="価格"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            slotProps={{ htmlInput: { step: "any" } }}
            autoFocus
            fullWidth
          />
          <TextField
            label="株数"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="trade-screening-group-label">根拠にしたスクリーニンググループ</InputLabel>
            <Select
              labelId="trade-screening-group-label"
              label="根拠にしたスクリーニンググループ"
              value={screeningGroupId}
              onChange={(e) => setScreeningGroupId(e.target.value)}
            >
              <MenuItem value="">
                <em>指定なし</em>
              </MenuItem>
              {groups?.map((g) => (
                <MenuItem key={g.groupId} value={String(g.groupId)}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="メモ"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          disabled={!canSubmit || createTrade.isPending}
          onClick={handleSubmit}
        >
          記録する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
