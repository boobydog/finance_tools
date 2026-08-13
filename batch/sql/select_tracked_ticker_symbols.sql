SELECT ticker_symbol
FROM user_stock_status
WHERE status IN ('interested', 'holding', 'excluded');
