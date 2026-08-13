INSERT INTO daily_stock_data (ticker_symbol, date, open_price, close_price, high_price, low_price, volume)
VALUES (:ticker_symbol, :date, :open_price, :close_price, :high_price, :low_price, :volume)
ON DUPLICATE KEY UPDATE
    open_price = VALUES(open_price),
    close_price = VALUES(close_price),
    high_price = VALUES(high_price),
    low_price = VALUES(low_price),
    volume = VALUES(volume);
