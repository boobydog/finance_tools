SELECT t.ticker_symbol, t.total_score
FROM technical_scores t
LEFT JOIN user_stock_status u ON u.ticker_symbol = t.ticker_symbol
WHERE u.status IS NULL AND t.total_score >= :threshold;
