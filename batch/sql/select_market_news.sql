SELECT news_id, ticker_symbol, company_name, title, url, published_at, source
FROM market_news
WHERE (:ticker_symbol IS NULL OR ticker_symbol = :ticker_symbol)
ORDER BY published_at DESC
LIMIT 100;
