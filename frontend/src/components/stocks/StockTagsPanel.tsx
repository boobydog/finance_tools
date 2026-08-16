"use client";

import { useState } from "react";
import { Autocomplete, Box, Chip, Stack, TextField } from "@mui/material";
import type { Tag } from "@/types";
import { useAttachStockTag, useDetachStockTag, useTags } from "@/hooks/useStocks";
import { useScreeningGroups } from "@/hooks/useScreening";

// スクリーニンググループ名と同じタグを付けると、次回の判定エンジン評価からそのグループの
// 買入/損切り/利確ルールが適用される(グループ解決はタグの一致で行う)。候補スクリーニングは
// 既にステータスが設定された銘柄(保有中・除外等)を再評価しないため、保有中銘柄に
// 別グループの基準を後から適用したい場合はここから手動で付け替える。
export function StockTagsPanel({ tickerSymbol, tags }: { tickerSymbol: string; tags: Tag[] }) {
  const { data: allTags } = useTags();
  const { data: groups } = useScreeningGroups();
  const attachTag = useAttachStockTag();
  const detachTag = useDetachStockTag();
  const [inputValue, setInputValue] = useState("");

  const groupNames = (groups ?? []).map((g) => g.name);
  const existingTagNames = new Set((allTags ?? []).map((t) => t.name));
  const attachedTagNames = new Set(tags.map((t) => t.name));
  const options = Array.from(new Set([...groupNames, ...existingTagNames])).filter(
    (name) => !attachedTagNames.has(name)
  );

  const handleAttach = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = (allTags ?? []).find((t) => t.name === trimmed);
    attachTag.mutate(
      existing ? { tickerSymbol, tagId: existing.tagId } : { tickerSymbol, tagName: trimmed },
      { onSuccess: () => setInputValue("") }
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        {tags.length === 0 && (
          <Chip label="タグなし" size="small" variant="outlined" sx={{ color: "text.secondary" }} />
        )}
        {tags.map((tag) => (
          <Chip
            key={tag.tagId}
            label={tag.name}
            size="small"
            onDelete={() => detachTag.mutate({ tickerSymbol, tagId: tag.tagId })}
            disabled={detachTag.isPending}
          />
        ))}
      </Stack>
      <Autocomplete
        freeSolo
        size="small"
        options={options}
        inputValue={inputValue}
        onInputChange={(_, value) => setInputValue(value)}
        onChange={(_, value) => value && handleAttach(value)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="タグを追加(スクリーニンググループ名で判定基準を切替)"
            placeholder="例: バフェット流・優良株"
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue.trim()) {
                e.preventDefault();
                handleAttach(inputValue);
              }
            }}
          />
        )}
        sx={{ maxWidth: 420 }}
        disabled={attachTag.isPending}
      />
    </Box>
  );
}
