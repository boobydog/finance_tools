-- statusが'interested'で、かつ「候補スクリーニングが無効化されたグループのタグ」は持っているが
-- 「候補スクリーニングが有効なグループのタグ」を1つも持たない銘柄
-- (= 無効化により候補としての根拠を失った銘柄)を返す。
-- 候補スクリーニングの有効/無効は is_active と candidate_screening_active の両方で決まる。
SELECT DISTINCT u.ticker_symbol
FROM user_stock_status u
JOIN stock_tags st ON st.ticker_symbol = u.ticker_symbol
JOIN tags t ON t.tag_id = st.tag_id
JOIN screening_groups g ON g.name = t.name
WHERE u.status = 'interested'
  AND (g.is_active = FALSE OR g.candidate_screening_active = FALSE)
  AND u.ticker_symbol NOT IN (
      SELECT st2.ticker_symbol
      FROM stock_tags st2
      JOIN tags t2 ON t2.tag_id = st2.tag_id
      JOIN screening_groups g2 ON g2.name = t2.name
      WHERE g2.is_active = TRUE AND g2.candidate_screening_active = TRUE
  );
