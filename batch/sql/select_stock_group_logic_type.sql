-- 銘柄が所属する有効なスクリーニンググループのうち、ターゲットプライス自動算出
-- ロジックが指定されているものを1件返す(複数該当する場合はgroup_idが小さい方を優先)。
SELECT g.auto_calc_logic_type
FROM stock_tags st
JOIN tags t ON t.tag_id = st.tag_id
JOIN screening_groups g ON g.name = t.name
WHERE st.ticker_symbol = :ticker_symbol
  AND g.is_active = TRUE
  AND g.auto_calc_logic_type IS NOT NULL
ORDER BY g.group_id
LIMIT 1;
