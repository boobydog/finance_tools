UPDATE stocks
SET is_under_supervision = TRUE
WHERE ticker_symbol = :ticker_symbol;
