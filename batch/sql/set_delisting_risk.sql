UPDATE stocks
SET is_delisting_risk = TRUE
WHERE ticker_symbol = :ticker_symbol;
