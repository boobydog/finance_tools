-- 利確判定の見直し(グループ別トレイリングストップ許容率、MA25クロスアンダー手仕舞い)。
--
-- 1. トレイリングストップの許容下落率(現在は全グループ共通の固定10%)をグループごとに
--    設定できるようにする。値幅の荒い小型株には広め、値動きが安定した大型株には
--    狭めの許容率を設定するのが望ましいという一般的な知見に基づく(NULLの場合は
--    従来通りapp_settingsのtrailing_stop_allowance_percent(既定10%)にフォールバック)。
ALTER TABLE screening_groups
    ADD COLUMN trailing_stop_allowance_percent INT NULL
    COMMENT 'トレイリングストップの許容下落率(%)。NULLはapp_settingsの全体設定にフォールバック'
    AFTER holding_period_exit_days;

-- 2. MA25クロスアンダー(現在値がMA25を下回った)による手仕舞いシグナルを、
--    利確判定の分類A(いずれか1つで売却検討)に追加する。is_below_ma25は
--    screening_param_definitionsに登録済みだったが、これまでどのグループの
--    ルールにも設定されていなかった(未活用)。トレンドの反転を機械的に検知する
--    シグナルとして、目標株価到達・PER過熱・トレイリングストップ発動と並ぶ
--    4つ目のOR条件として全有効グループに追加する。
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, value_mode, min_threshold)
SELECT group_id, 'profit_taking', 'A', 'is_below_ma25', 'eq', 'fixed', 1
FROM screening_groups
WHERE is_active = 1
  AND group_id NOT IN (
      SELECT group_id FROM screening_rules
      WHERE rule_purpose = 'profit_taking' AND param_key = 'is_below_ma25'
  );

-- 3. トレイリングストップ許容下落率をセグメント別に設定する。
--    小型株はボラティリティが高く値動きのノイズで早期に振り落とされやすいため広め、
--    大型株は値動きが安定しモメンタムの反転も相対的に緩やかなため狭めに設定する。
UPDATE screening_groups SET trailing_stop_allowance_percent = 15 WHERE name = '小型株';
UPDATE screening_groups SET trailing_stop_allowance_percent = 12 WHERE name = '中型株';
UPDATE screening_groups SET trailing_stop_allowance_percent = 8  WHERE name = '大型株';
-- デフォルトグループはapp_settings側の全体設定(既定10%)をそのまま使う(NULLのまま)。
