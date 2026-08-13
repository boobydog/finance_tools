INSERT INTO stocks (ticker_symbol, name, market_segment, sector)
VALUES (:ticker_symbol, :name, :market_segment, :sector)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    market_segment = VALUES(market_segment),
    sector = VALUES(sector);
