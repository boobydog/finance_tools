UPDATE user_stock_status
SET target_price_at_purchase = :target_price_at_purchase, target_price_at_purchase_logic = :target_price_at_purchase_logic
WHERE ticker_symbol = :ticker_symbol;
