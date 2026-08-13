-- 損切り判定画面向け: 保有中(holding)銘柄のリスク・評価低下シグナル関連指標を返す。
SELECT
    s.ticker_symbol,
    s.name,
    s.sector,
    s.is_under_supervision,
    s.is_delisting_risk,
    u.purchase_score,
    t.total_score AS current_score,
    d.close_price AS current_price,
    buy.purchase_price,
    m.operating_profit_yoy,
    m.eps_growth,
    m.hv
FROM stocks s
JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
LEFT JOIN technical_scores t ON t.ticker_symbol = s.ticker_symbol
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
