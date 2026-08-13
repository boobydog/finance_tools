-- 売買履歴(どの条件・戦略の時に売買したかの根拠を記録する)
CREATE TABLE trade_history (
    trade_id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '売買履歴ID',
    ticker_symbol       VARCHAR(10)   NOT NULL COMMENT '証券コード',
    action              ENUM('buy', 'sell') NOT NULL COMMENT '売買区分',
    price               DECIMAL(15,2) NOT NULL COMMENT '約定価格',
    quantity            INT           NOT NULL COMMENT '株数',
    traded_at           DATETIME      NOT NULL COMMENT '約定日時',
    screening_group_id  INT                    COMMENT '判断根拠としたスクリーニンググループID',
    memo                TEXT                   COMMENT 'メモ',
    PRIMARY KEY (trade_id),
    CONSTRAINT fk_trade_history_ticker_symbol
        FOREIGN KEY (ticker_symbol) REFERENCES stocks (ticker_symbol),
    CONSTRAINT fk_trade_history_screening_group_id
        FOREIGN KEY (screening_group_id) REFERENCES screening_groups (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
