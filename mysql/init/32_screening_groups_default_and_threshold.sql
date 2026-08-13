-- 損切り・利確・買入タイミングの各判定基準をグループ単位で編集可能にするための拡張。
-- is_default: 銘柄がどの用途別グループにも該当しない場合に使うフォールバックグループ。
--   用途(purpose)ごとに1件のみtrueであるべき(アプリ側で担保する)。
-- signal_count_threshold: purpose='entry'のグループでのみ使用。分類C条件のうち
--   いくつ満たせば「有力候補」とするかの閾値(例: 3件中2件以上)。
ALTER TABLE screening_groups
    ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'この用途のフォールバックグループか' AFTER auto_calc_logic_type,
    ADD COLUMN signal_count_threshold INT NULL COMMENT '(entry用途のみ)分類C条件の必要充足数' AFTER is_default;
