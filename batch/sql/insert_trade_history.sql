INSERT INTO trade_history (ticker_symbol, action, price, quantity, traded_at, screening_group_id, memo)
VALUES (:ticker_symbol, :action, :price, :quantity, :traded_at, :screening_group_id, :memo);
