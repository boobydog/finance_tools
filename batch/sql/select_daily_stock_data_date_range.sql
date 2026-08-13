SELECT MIN(date) AS min_date, MAX(date) AS max_date
FROM daily_stock_data
WHERE ticker_symbol = :ticker_symbol;
