INSERT INTO user_stock_status (ticker_symbol, status, purchase_score, highest_price_since_purchase)
VALUES (:ticker_symbol, :status, :purchase_score, :purchase_price)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    purchase_score = VALUES(purchase_score),
    highest_price_since_purchase = VALUES(highest_price_since_purchase);
