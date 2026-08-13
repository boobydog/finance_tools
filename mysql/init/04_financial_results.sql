-- 決算・指標情報（金額は特記ない限り百万円単位）
CREATE TABLE financial_results (
    ticker_symbol         VARCHAR(10)   NOT NULL COMMENT '証券コード',
    fiscal_period         VARCHAR(20)   NOT NULL COMMENT '決算期 (e.g., 2024Q1)',
    revenue               BIGINT                  COMMENT '売上高',
    operating_profit      BIGINT                  COMMENT '営業利益',
    eps                   DECIMAL(15,2)           COMMENT '1株当たり利益',
    market_forecast_eps   DECIMAL(15,2)           COMMENT '市場予想EPS',
    dividend_per_share    DECIMAL(10,2)           COMMENT '1株当たり配当',
    equity_ratio          DECIMAL(5,2)            COMMENT '自己資本比率',
    roe                   DECIMAL(5,2)            COMMENT 'ROE',
    operating_cf          BIGINT                  COMMENT '営業CF',
    PRIMARY KEY (ticker_symbol, fiscal_period),
    CONSTRAINT fk_financial_results_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
