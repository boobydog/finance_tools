INSERT IGNORE INTO market_news (news_id, ticker_symbol, company_name, title, url, published_at)
VALUES (:news_id, :ticker_symbol, :company_name, :title, :url, :published_at);
