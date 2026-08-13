-- 「小型株」グループ(売上高営業利益率)の評価に必要なため追加。
-- あわせてmarket_capの単位を百万円に統一する(他の金額項目と同じ規約)。
ALTER TABLE stock_metrics ADD COLUMN operating_margin DECIMAL(10, 4) COMMENT '売上高営業利益率(%)' AFTER revenue_yoy;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('operating_margin', '売上高営業利益率', 'number', -100, 100, '%', '営業利益 ÷ 売上高');

UPDATE screening_param_definitions SET unit = '百万円' WHERE param_key = 'market_cap';
