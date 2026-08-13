WITH ranked_prices AS (
    SELECT
        ticker_symbol,
        close_price,
        ROW_NUMBER() OVER (PARTITION BY ticker_symbol ORDER BY date DESC) AS rn
    FROM daily_stock_data
    WHERE ticker_symbol = :ticker_symbol
)
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
LEFT JOIN ranked_prices latest ON latest.ticker_symbol = s.ticker_symbol AND latest.rn = 1
LEFT JOIN ranked_prices prev ON prev.ticker_symbol = s.ticker_symbol AND prev.rn = 2
WHERE s.ticker_symbol = :ticker_symbol;
