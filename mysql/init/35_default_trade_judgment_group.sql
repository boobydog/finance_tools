-- どのスクリーニンググループのタグも持たない銘柄向けのフォールバック用デフォルトグループ。
-- 削除不可(アプリ側で保護)。候補スクリーニングはデフォルトでは無効(candidate_screening_active=FALSE)
-- とし、買入タイミング/損切り判定/利確判定の基準のみをフォールバックとして使う。
-- ルールの閾値は、これまで frontend/src/lib/tradeSignals.ts にハードコードされていた
-- 基準をそのまま踏襲する。
INSERT INTO screening_groups
    (name, description, is_active, purpose, is_default, candidate_screening_active, signal_count_threshold)
VALUES
    ('デフォルト', 'どのグループにも該当しない銘柄に使うフォールバック基準。候補スクリーニングは既定で無効。',
     TRUE, 'entry', TRUE, FALSE, 2);
SET @default_group_id = LAST_INSERT_ID();

INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, min_threshold) VALUES
    (@default_group_id, 'entry_timing', 'C', 'is_above_ma25', 'eq', 1),
    (@default_group_id, 'entry_timing', 'C', 'volume_ratio', 'gte', 2.0),
    (@default_group_id, 'entry_timing', 'C', 'earnings_surprise_percent', 'gte', 0),

    (@default_group_id, 'loss_cut', 'A', 'is_delisting_risk', 'eq', 1),
    (@default_group_id, 'loss_cut', 'A', 'is_under_supervision', 'eq', 1),
    (@default_group_id, 'loss_cut', 'A', 'drawdown_percent', 'lte', -15),
    (@default_group_id, 'loss_cut', 'B', 'operating_profit_yoy', 'lte', 0),
    (@default_group_id, 'loss_cut', 'B', 'eps_growth', 'lte', 0),
    (@default_group_id, 'loss_cut', 'B', 'score_diff', 'lte', -20),

    (@default_group_id, 'profit_taking', 'A', 'achievement_percent', 'gte', 100),
    (@default_group_id, 'profit_taking', 'A', 'forward_per', 'gte', 60),
    (@default_group_id, 'profit_taking', 'A', 'is_trailing_stop_triggered', 'eq', 1);
