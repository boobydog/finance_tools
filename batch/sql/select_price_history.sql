SELECT date, open_price, high_price, low_price, close_price, volume
FROM daily_stock_data
WHERE ticker_symbol = :ticker_symbol
ORDER BY date ASC;
