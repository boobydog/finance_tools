-- スクリーニング条件のparam_keyごとのバリデーション基準(yfinance由来の指標の一般的なレンジ)
CREATE TABLE screening_param_definitions (
    param_key   VARCHAR(100) NOT NULL COMMENT 'パラメータキー',
    label       VARCHAR(100) NOT NULL COMMENT '画面表示名',
    value_type  ENUM('number', 'string', 'boolean') NOT NULL DEFAULT 'number' COMMENT '値の型',
    min_value   DECIMAL(15, 4) NULL COMMENT '下限値(value_type=numberのみ有効)',
    max_value   DECIMAL(15, 4) NULL COMMENT '上限値(value_type=numberのみ有効)',
    unit        VARCHAR(20) NULL COMMENT '単位',
    description VARCHAR(255) NULL COMMENT '備考',
    PRIMARY KEY (param_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('forward_per', 'PER(予想)', 'number', -100, 1000, '倍', '赤字〜超割高'),
    ('pbr', 'PBR', 'number', 0, 100, '倍', '解散価値以下〜'),
    ('equity_ratio', '自己資本比率', 'number', 0, 100, '%', '財務健全性'),
    ('eps_growth', 'EPS成長率', 'number', -100, 1000, '%', '成長率の爆発力'),
    ('dividend_yield', '配当利回り', 'number', 0, 20, '%', '高配当の現実的範囲'),
    ('roe', 'ROE', 'number', -100, 200, '%', '自己資本利益率'),
    ('operating_profit_yoy', '営業利益 前期比', 'number', -100, 1000, '%', NULL),
    ('revenue_yoy', '売上高 前期比', 'number', -100, 1000, '%', NULL),
    ('operating_cf', '営業CF', 'number', NULL, NULL, '百万円', NULL),
    ('relative_strength', '相対強度(RS)', 'number', 0, 10, '倍', '日経225比'),
    ('rsi', 'RSI', 'number', 0, 100, NULL, NULL),
    ('volume_ratio', '出来高倍率', 'number', 0, 100, '倍', '20日平均比'),
    ('is_under_supervision', '監理銘柄フラグ', 'boolean', NULL, NULL, NULL, NULL),
    ('is_delisting_risk', '上場廃止リスク', 'boolean', NULL, NULL, NULL, NULL);
