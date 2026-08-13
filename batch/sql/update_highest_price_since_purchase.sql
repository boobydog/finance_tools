-- 保有中(holding)銘柄について、直近キャッシュ済み終値との比較で保有期間中の最高値を更新する。
UPDATE user_stock_status u
JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.max_date
) latest ON latest.ticker_symbol = u.ticker_symbol
SET u.highest_price_since_purchase = GREATEST(COALESCE(u.highest_price_since_purchase, 0), latest.close_price)
WHERE u.status = 'holding';
