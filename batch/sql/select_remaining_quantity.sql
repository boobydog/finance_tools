-- 銘柄の残存保有数(複数回の買い増し・部分売却を集計した合計、口座種別問わず)。
-- 0以下になったら保有ポジションが完全に決済されたとみなす。
SELECT
    COALESCE(SUM(CASE WHEN action = 'buy' THEN quantity ELSE -quantity END), 0) AS remaining_quantity
FROM trade_history
WHERE ticker_symbol = :ticker_symbol;
