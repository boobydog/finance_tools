SELECT close_price FROM daily_stock_data WHERE ticker_symbol = :ticker_symbol ORDER BY date DESC LIMIT 1;
