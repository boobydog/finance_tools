INSERT INTO trade_history (ticker_symbol, action, price, quantity, traded_at, screening_group_id, memo, account_type)
VALUES (:ticker_symbol, :action, :price, :quantity, :traded_at, :screening_group_id, :memo, :account_type);
