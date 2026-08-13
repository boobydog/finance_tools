UPDATE user_stock_status
SET target_price_auto = :target_price_auto, target_price_auto_logic = :target_price_auto_logic
WHERE ticker_symbol = :ticker_symbol;
