-- 買入タイミング判定・損切り判定・利確判定をグループ別ルールで評価できるようにするための
-- パラメータ追加。stock_metricsの既存カラムに加え、判定エンジンが実行時に算出する
-- 派生値(banner: 派生値)も同じparam_keyカタログに登録し、スクリーニングと同じUIで
-- ルールの値(閾値)を設定できるようにする。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('earnings_surprise_percent', '決算サプライズ(市場予想乖離率)', 'number', -1000, 10000, '%', '直近決算の市場予想との乖離率'),
    ('is_above_ma25', 'MA25上抜け', 'boolean', NULL, NULL, NULL, '現在値がMA25を上回っているか(派生値)'),
    ('is_trailing_stop_triggered', 'トレイリングストップ発動', 'boolean', NULL, NULL, NULL, '最高値からの逆指値ラインに到達したか(派生値)'),
    ('achievement_percent', 'ターゲットプライス達成度', 'number', 0, 1000, '%', 'ターゲットプライスに対する現在値の達成度(派生値)'),
    ('drawdown_percent', '購入価格からの下落率', 'number', -100, 100, '%', '購入価格を基準にした現在値の増減率(派生値)'),
    ('score_diff', '購入時からのスコア変化', 'number', -100, 100, 'pt', '購入時の技術スコアからの変化量(派生値)');
