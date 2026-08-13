INSERT INTO user_stock_status (ticker_symbol, status)
VALUES (:ticker_symbol, :status)
ON DUPLICATE KEY UPDATE status = VALUES(status);
