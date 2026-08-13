-- 「高スコア候補化」のしきい値変更等で、現在のスコアがしきい値未満になった銘柄を
-- 抽出する(有効なスクリーニンググループのタグを別途持つ銘柄は対象外)。
SELECT DISTINCT u.ticker_symbol
FROM user_stock_status u
JOIN technical_scores t ON t.ticker_symbol = u.ticker_symbol
WHERE u.status = 'interested'
  AND t.total_score < :threshold
  AND u.ticker_symbol NOT IN (
      SELECT st.ticker_symbol
      FROM stock_tags st
      JOIN tags tg ON tg.tag_id = st.tag_id
      WHERE tg.name IN (SELECT name FROM screening_groups WHERE is_active = TRUE)
  );
