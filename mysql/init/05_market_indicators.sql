-- 為替・指数データ
CREATE TABLE market_indicators (
    date        DATE          NOT NULL COMMENT '年月日',
    fx_usd_jpy  DECIMAL(10,4)          COMMENT '米ドル/円レート',
    PRIMARY KEY (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
