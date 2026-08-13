-- アプリ全体の小さな設定値(key-value)を保持する。
-- 現時点ではテクニカルスコアによる自動候補化のしきい値のみを保持する。
CREATE TABLE app_settings (
    setting_key   VARCHAR(100) NOT NULL COMMENT '設定キー',
    setting_value VARCHAR(255) NOT NULL COMMENT '設定値',
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('technical_score_candidate_threshold', '60');
