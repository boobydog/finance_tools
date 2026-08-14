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
  FormHelperText,
} from "@mui/material";
import { useCreateTrade } from "@/hooks/useStocks";
import { useScreeningGroups } from "@/hooks/useScreening";
import type { AccountType } from "@/types";

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "taxable", label: "特定口座(源泉徴収あり)/一般口座" },
  { value: "nisa", label: "NISA口座" },
];

// 「どの条件(スクリーニンググループ)の時に売買したか」の根拠とメモをtrade_historyへ
// 保存するため、購入/売却時にこのダイアログで価格・数量・根拠・メモを入力させる。
export function TradeDialog({
  open,
  onClose,
  tickerSymbol,
  stockName,
  action,
  currentPrice,
}: {
  open: boolean;
  onClose: () => void;
  tickerSymbol: string;
  stockName: string;
  action: "buy" | "sell";
  currentPrice?: number | null;
}) {
  const { data: groups } = useScreeningGroups();
  const createTrade = useCreateTrade();

  // 購入時は価格欄に現在値を初期入力しておき、そのまま/微調整して記録できるようにする。
  const [price, setPrice] = useState(action === "buy" && currentPrice != null ? String(currentPrice) : "");
  const [quantity, setQuantity] = useState("");
  const [screeningGroupId, setScreeningGroupId] = useState(""); // "" = 指定なし、それ以外はgroupIdの文字列表現
  const [memo, setMemo] = useState("");
  // 損切り・利確判定画面で税率・手数料を反映するかどうかの判断に使う(NISA口座は非課税・手数料無料)。
  const [accountType, setAccountType] = useState<AccountType>("taxable");

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
          accountType,
        },
      },
      {
        onSuccess: () => {
          setPrice("");
          setQuantity("");
          setScreeningGroupId("");
          setMemo("");
          setAccountType("taxable");
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
            <InputLabel id="trade-account-type-label">口座種別</InputLabel>
            <Select
              labelId="trade-account-type-label"
              label="口座種別"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
            >
              {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {action === "sell" && (
              <FormHelperText>どちらの口座の保有分を売却するかを選択してください</FormHelperText>
            )}
          </FormControl>
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
