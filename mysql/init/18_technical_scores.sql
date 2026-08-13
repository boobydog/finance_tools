-- technical_screener(ワインスタイン/RS/出来高/RSI/VCPの5要素スコアリング)の結果を保存する。
CREATE TABLE technical_scores (
    ticker_symbol  VARCHAR(10) NOT NULL COMMENT '証券コード',
    total_score    INT NOT NULL COMMENT '合計スコア',
    stage2_score   INT COMMENT 'ワインスタイン ステージ2判定スコア',
    rs_score       INT COMMENT '相対強度(RS)スコア',
    volume_score   INT COMMENT '出来高急増スコア',
    rsi_score      INT COMMENT 'RSI適温ゾーンスコア',
    vcp_score      INT COMMENT 'VCP/52週高値圏スコア',
    computed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ticker_symbol),
    CONSTRAINT fk_technical_scores_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
