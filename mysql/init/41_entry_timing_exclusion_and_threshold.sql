-- 買入タイミング判定の精度向上のための拡張。
-- 1) スクリーニングスコア(テクニカルスコア合計点)をルールで使えるパラメータとして登録する。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('screening_score', 'スクリーニングスコア', 'number', -100, 100, 'pt', 'テクニカルスコアリング(Weinstein/RS/出来高/RSI/VCP)の合計点');

-- 2) 買入タイミング(entry_timing)の有力候補しきい値を、3件中2件から3件中3件(全シグナル一致)に引き上げる。
UPDATE screening_groups SET signal_count_threshold = 3 WHERE group_id IN (6, 7, 8, 12);

-- 3) スコアによる足切り(分類A: スクリーニングスコアが20点以下なら除外)を追加する。
--    分類C(シグナル数)の条件をすべて満たしていても、この条件に該当する場合は
--    有力候補としない(買入タイミング判定にも損切り・利確と同様の除外条件を持たせる)。
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, value_mode, min_threshold) VALUES
    (6, 'entry_timing', 'A', 'screening_score', 'lte', 'fixed', 20),
    (7, 'entry_timing', 'A', 'screening_score', 'lte', 'fixed', 20),
    (8, 'entry_timing', 'A', 'screening_score', 'lte', 'fixed', 20),
    (12, 'entry_timing', 'A', 'screening_score', 'lte', 'fixed', 20);
