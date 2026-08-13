-- スクリーニング条件のグループ(戦略)管理
CREATE TABLE screening_groups (
    group_id     INT          NOT NULL AUTO_INCREMENT COMMENT 'グループID',
    name         VARCHAR(100) NOT NULL COMMENT 'グループ名(戦略名)',
    description  TEXT                  COMMENT '説明',
    PRIMARY KEY (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
