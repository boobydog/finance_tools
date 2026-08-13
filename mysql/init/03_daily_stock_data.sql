-- 日次株価・出来高データ
CREATE TABLE daily_stock_data (
    ticker_symbol  VARCHAR(10)    NOT NULL COMMENT '証券コード',
    date           DATE           NOT NULL COMMENT '年月日',
    close_price    DECIMAL(15,2)           COMMENT '終値',
    volume         BIGINT                  COMMENT '出来高',
    PRIMARY KEY (ticker_symbol, date),
    CONSTRAINT fk_daily_stock_data_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
