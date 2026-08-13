-- 銘柄ごとの数値指標スナップショット(screening_param_definitionsの数値項目に対応)。
-- yfinanceから取得した基礎指標と、technical_screenerと同じロジックで計算した
-- 技術指標を1銘柄1行にまとめ、判定エンジン(screening_engine)が高速に評価できるようにする。
CREATE TABLE stock_metrics (
    ticker_symbol         VARCHAR(10) NOT NULL COMMENT '証券コード',
    forward_per           DECIMAL(15, 4) COMMENT 'PER(予想)',
    pbr                   DECIMAL(15, 4) COMMENT 'PBR',
    dividend_yield        DECIMAL(10, 4) COMMENT '配当利回り(%)',
    equity_ratio          DECIMAL(10, 4) COMMENT '自己資本比率(%)',
    roe                   DECIMAL(10, 4) COMMENT 'ROE(%)',
    eps_growth            DECIMAL(15, 4) COMMENT 'EPS成長率(%)',
    operating_profit_yoy  DECIMAL(15, 4) COMMENT '営業利益 前期比(%)',
    revenue_yoy           DECIMAL(15, 4) COMMENT '売上高 前期比(%)',
    operating_cf          BIGINT COMMENT '営業CF(百万円)',
    relative_strength     DECIMAL(10, 4) COMMENT '相対強度(RS、日経225比)',
    rsi                   DECIMAL(10, 4) COMMENT 'RSI',
    volume_ratio          DECIMAL(10, 4) COMMENT '出来高倍率(20日平均比)',
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ticker_symbol),
    CONSTRAINT fk_stock_metrics_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
