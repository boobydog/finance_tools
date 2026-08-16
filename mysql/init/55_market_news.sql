-- TDnet(東証の適時開示情報)から取得する銘柄関連ニュースを格納するテーブル。
-- news_id(TDnetの開示ID)をPKとして、同じ開示の重複取込を防ぐ(EDINETのedinet_filingsと
-- 同じ「取込済み台帳」パターン)。
CREATE TABLE market_news (
    news_id VARCHAR(20) NOT NULL COMMENT 'TDnetの開示ID',
    ticker_symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255) NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(500) NULL,
    published_at DATETIME NOT NULL COMMENT '適時開示の提出日時',
    source VARCHAR(50) NOT NULL DEFAULT 'TDnet',
    fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (news_id),
    KEY idx_market_news_ticker_published (ticker_symbol, published_at),
    CONSTRAINT fk_market_news_ticker FOREIGN KEY (ticker_symbol) REFERENCES stocks(ticker_symbol)
) COMMENT='TDnet(適時開示情報)から取得した銘柄関連ニュース';
