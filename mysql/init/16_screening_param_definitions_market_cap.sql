-- 旧config/screen_conditions.json(yfinanceスクリーナー形式)からの変換で使用する
-- 時価総額パラメータを追加する。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('market_cap', '時価総額', 'number', 0, NULL, '円', '旧screen_conditions.jsonのintradaymarketcapに相当');
