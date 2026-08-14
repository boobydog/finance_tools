-- 売買記録削除後のステータス整合に使う: 残っている取引記録の件数と、口座種別問わずの
-- 残存保有数(買い数量の合計 - 売り数量の合計)。
SELECT
    COUNT(*) AS trade_count,
    COALESCE(SUM(CASE WHEN action = 'buy' THEN quantity ELSE -quantity END), 0) AS remaining_quantity
FROM trade_history
WHERE ticker_symbol = :ticker_symbol;
