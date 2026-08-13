-- スクリーニング条件
CREATE TABLE screening_rules (
    rule_id        INT             NOT NULL AUTO_INCREMENT COMMENT 'ルールID',
    category       ENUM('A','B','C') NOT NULL COMMENT '判定カテゴリ',
    min_threshold  DECIMAL(15,4)                COMMENT '最小閾値',
    max_threshold  DECIMAL(15,4)                COMMENT '最大閾値',
    rule_metadata  JSON                          COMMENT '追加パラメータ（キーワード等）',
    PRIMARY KEY (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
