-- 日経225銘柄一覧を、最新2日分の終値(前日比計算用)とあわせて返す。
-- daily_stock_dataは10万行超あるため、ROW_NUMBER()を全件に対して計算すると
-- 索引が使えず低速(数秒)になる。代わりにticker_symbolごとのMAX(date)を
-- GROUP BYで求めてから該当行だけを引く方式にすることで、索引(ticker_symbol, date)
-- のloose index scanが効き、大幅に高速化できる(数秒->数百ミリ秒未満)。
SELECT
    s.ticker_symbol,
    s.name,
    s.market_segment,
    s.sector,
    s.is_under_supervision,
    s.is_delisting_risk,
    u.status,
    u.purchase_score,
    u.target_price_auto,
    u.target_price_manual,
    u.target_price_at_purchase,
    u.target_price_auto_logic,
    u.target_price_at_purchase_logic,
    t.total_score AS screening_score,
    latest.close_price AS latest_close,
    prev.close_price AS previous_close
FROM stocks s
LEFT JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
LEFT JOIN technical_scores t ON t.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.max_date
) latest ON latest.ticker_symbol = s.ticker_symbol
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
WHERE s.is_nikkei225 = TRUE
ORDER BY s.ticker_symbol;
