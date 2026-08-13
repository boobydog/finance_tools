-- ユーザー保有管理
CREATE TABLE user_stock_status (
    ticker_symbol  VARCHAR(10) NOT NULL COMMENT '証券コード',
    status         ENUM('interested', 'holding', 'sold') COMMENT 'ステータス',
    PRIMARY KEY (ticker_symbol),
    CONSTRAINT fk_user_stock_status_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
