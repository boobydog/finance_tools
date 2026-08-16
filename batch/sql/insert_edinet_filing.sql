INSERT INTO edinet_filings (doc_id, ticker_symbol, edinet_code, doc_type_code, period_end, submitted_at)
VALUES (:doc_id, :ticker_symbol, :edinet_code, :doc_type_code, :period_end, :submitted_at);
