-- 実行ログ・リトライ管理
CREATE TABLE batch_logs (
    log_id         BIGINT      NOT NULL AUTO_INCREMENT COMMENT 'ログID',
    process_name   VARCHAR(100)         COMMENT '処理名',
    status         VARCHAR(20)          COMMENT 'SUCCESS/FAIL/RETRYING',
    retry_count    INT         NOT NULL DEFAULT 0 COMMENT '現在の再試行回数',
    error_message  TEXT                 COMMENT 'エラー内容',
    -- 4章のリトライ戦略(5分/30分/1時間間隔)の判定に必要なため追加
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '初回登録日時',
    updated_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最終更新日時',
    PRIMARY KEY (log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
