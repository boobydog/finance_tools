-- 銘柄の現在のスコア階層タグ以外の「高スコア(X点以上)」タグを外す。
-- current_tag_nameに空文字を渡すと(実在のタグ名とは一致しないため)全て外れる。
DELETE st FROM stock_tags st
JOIN tags t ON t.tag_id = st.tag_id
WHERE st.ticker_symbol = :ticker_symbol
  AND t.name LIKE '高スコア(%点以上)'
  AND t.name <> :current_tag_name;
