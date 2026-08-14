-- 利確判定に、トレンド反転(MA25割れ)を売却シグナルとして追加できるようにする
-- (「①テクニカルな反転で手仕舞い」)。既存のparam_definitionsの仕組みで
-- そのまま使えるよう、新しいparam_keyを1つ登録するだけでよい。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('is_below_ma25', 'MA25割れ', 'boolean', NULL, NULL, NULL, '現在値がMA25を下回っているか(派生値。トレンド反転による手仕舞いシグナル)');

-- 「②保有期間満了による強制決済」は、損切り・利確とは別の第3の判定軸として扱う。
-- 損益の状態に関わらず機械的に決済する規律ルールのため、利確判定の
-- 純損益ゲート(手数料・税引後に黒字でなければ利確シグナルとしない)の対象外とする。
-- グループごとに保有期間の上限(日数)を設定する(NULLはこの機能を使わない)。
ALTER TABLE screening_groups
    ADD COLUMN holding_period_exit_days INT NULL COMMENT '保有期間の上限(日数、超えたら損益に関わらず強制決済。NULLは無効)' AFTER signal_count_threshold;
