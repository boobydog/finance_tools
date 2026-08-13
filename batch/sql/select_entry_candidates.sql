-- 買入タイミング判定画面向け: 候補(interested)銘柄のエントリーシグナル関連指標を返す。
SELECT
    s.ticker_symbol,
    s.name,
    s.sector,
    d.close_price AS current_price,
    prev.close_price AS previous_close,
    m.ma25,
    m.ma25_above_streak_days,
    m.volume_ratio,
    m.earnings_surprise_percent,
    m.rsi,
    m.hv,
    t.total_score AS screening_score
FROM stocks s
JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
LEFT JOIN stock_metrics m ON m.ticker_symbol = s.ticker_symbol
LEFT JOIN technical_scores t ON t.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.max_date
) d ON d.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT d3.ticker_symbol, MAX(d3.date) AS prev_date
        FROM daily_stock_data d3
        INNER JOIN (
            SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
        ) mx ON d3.ticker_symbol = mx.ticker_symbol AND d3.date < mx.max_date
        GROUP BY d3.ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.prev_date
) prev ON prev.ticker_symbol = s.ticker_symbol
WHERE u.status = 'interested'
ORDER BY t.total_score DESC;
