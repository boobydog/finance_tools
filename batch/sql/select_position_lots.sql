-- 保有中銘柄について、口座種別(特定/一般 or NISA)ごとの残存数量・加重平均取得単価を
-- 集計する(複数回の買い増し・部分売却に対応するため)。NISAと特定/一般口座は
-- 税制上別勘定のため、手数料・税引後損益はこの口座種別ごとの単価で計算する必要がある。
-- 残存数量が0以下になった口座種別(=決済済み)は除外する。
SELECT
    ticker_symbol,
    account_type,
    SUM(CASE WHEN action = 'buy' THEN quantity ELSE -quantity END) AS remaining_quantity,
    SUM(CASE WHEN action = 'buy' THEN price * quantity ELSE 0 END)
        / NULLIF(SUM(CASE WHEN action = 'buy' THEN quantity ELSE 0 END), 0) AS avg_purchase_price
FROM trade_history
GROUP BY ticker_symbol, account_type
HAVING SUM(CASE WHEN action = 'buy' THEN quantity ELSE -quantity END) > 0;
