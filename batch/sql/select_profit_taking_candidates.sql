-- 利確判定画面向け: 保有中(holding)銘柄の目標達成度・過熱感・トレイリングストップ関連指標を返す。
SELECT
    s.ticker_symbol,
    s.name,
    s.sector,
    d.close_price AS current_price,
    u.target_price_auto,
    u.target_price_manual,
    u.target_price_at_purchase,
    u.target_price_auto_logic,
    u.target_price_at_purchase_logic,
    u.highest_price_since_purchase,
    m.forward_per,
    m.hv,
    buy.purchase_price
FROM stocks s
JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
LEFT JOIN stock_metrics m ON m.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.max_date
) d ON d.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT th1.ticker_symbol, th1.price AS purchase_price
    FROM trade_history th1
    INNER JOIN (
        SELECT ticker_symbol, MAX(traded_at) AS max_traded_at
        FROM trade_history WHERE action = 'buy' GROUP BY ticker_symbol
    ) th2 ON th1.ticker_symbol = th2.ticker_symbol AND th1.traded_at = th2.max_traded_at
    WHERE th1.action = 'buy'
) buy ON buy.ticker_symbol = s.ticker_symbol
WHERE u.status = 'holding'
ORDER BY s.ticker_symbol;
