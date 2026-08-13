-- 買入タイミング判定の「単日の急騰を有力候補として誤検知してしまう」問題への対策。
-- 既存の3シグナル(MA25上抜け・出来高急増・決算サプライズ)は方向性の是非のみを見ており、
-- 動きの大きさや持続性を見ていないため、単日で急騰した銘柄をむしろ強く拾ってしまう。
-- 以下の除外条件(分類A)を追加することで、「動きすぎ・急ぎすぎ」の銘柄を弾く。

-- 1) MA25上抜け継続日数(派生値): 直近何営業日連続でMA25を上回っているか。
ALTER TABLE stock_metrics
    ADD COLUMN ma25_above_streak_days INT NULL COMMENT 'MA25を連続で上回っている営業日数' AFTER ma25;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('ma25_deviation_percent', 'MA25乖離率', 'number', -100, 200, '%', '現在値がMA25から何%乖離しているか(派生値)'),
    ('daily_change_percent', '前日比騰落率', 'number', -100, 200, '%', '前日終値からの当日騰落率(派生値)'),
    ('ma25_above_streak_days', 'MA25上抜け継続日数', 'number', 0, 300, '日', '直近何営業日連続でMA25を上回っているか');

-- 2) 除外条件(分類A)を追加: RSI過熱・MA25からの乖離しすぎ・前日比の急騰・
--    MA25上抜けの持続日数不足(=今日初めて上抜けたばかり)のいずれかに該当する場合は除外する。
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, value_mode, min_threshold) VALUES
    (6, 'entry_timing', 'A', 'rsi', 'gte', 'fixed', 70),
    (6, 'entry_timing', 'A', 'ma25_deviation_percent', 'gte', 'fixed', 10),
    (6, 'entry_timing', 'A', 'daily_change_percent', 'gte', 'fixed', 8),
    (6, 'entry_timing', 'A', 'ma25_above_streak_days', 'lte', 'fixed', 2),

    (7, 'entry_timing', 'A', 'rsi', 'gte', 'fixed', 70),
    (7, 'entry_timing', 'A', 'ma25_deviation_percent', 'gte', 'fixed', 10),
    (7, 'entry_timing', 'A', 'daily_change_percent', 'gte', 'fixed', 8),
    (7, 'entry_timing', 'A', 'ma25_above_streak_days', 'lte', 'fixed', 2),

    (8, 'entry_timing', 'A', 'rsi', 'gte', 'fixed', 70),
    (8, 'entry_timing', 'A', 'ma25_deviation_percent', 'gte', 'fixed', 10),
    (8, 'entry_timing', 'A', 'daily_change_percent', 'gte', 'fixed', 8),
    (8, 'entry_timing', 'A', 'ma25_above_streak_days', 'lte', 'fixed', 2),

    (12, 'entry_timing', 'A', 'rsi', 'gte', 'fixed', 70),
    (12, 'entry_timing', 'A', 'ma25_deviation_percent', 'gte', 'fixed', 10),
    (12, 'entry_timing', 'A', 'daily_change_percent', 'gte', 'fixed', 8),
    (12, 'entry_timing', 'A', 'ma25_above_streak_days', 'lte', 'fixed', 2);
