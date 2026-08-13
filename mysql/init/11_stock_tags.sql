-- 銘柄とタグの中間テーブル
CREATE TABLE stock_tags (
    ticker_symbol VARCHAR(10) NOT NULL COMMENT '証券コード',
    tag_id        INT         NOT NULL COMMENT 'タグID',
    PRIMARY KEY (ticker_symbol, tag_id),
    CONSTRAINT fk_stock_tags_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol),
    CONSTRAINT fk_stock_tags_tag_id
        FOREIGN KEY (tag_id) REFERENCES tags (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
