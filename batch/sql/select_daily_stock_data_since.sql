SELECT date, open_price, close_price, high_price, low_price, volume
FROM daily_stock_data
WHERE ticker_symbol = :ticker_symbol AND date >= :start_date
ORDER BY date ASC;
