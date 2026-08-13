-- 1グループの中に「候補スクリーニング」「買入タイミング」「損切り判定」「利確判定」の
-- 4種類のルールセットをまとめて持たせられるようにする(グループ=戦略単位、
-- rule_purpose=そのグループ内でのルールの用途)。
-- candidate_screening_active: グループ全体のis_activeとは別に、候補スクリーニング
-- (自動候補化)部分だけを個別に有効/無効化するためのフラグ。
-- 主にデフォルトグループ(タグなし銘柄向けフォールバック)で、買入タイミング/損切り/利確の
-- 基準は使いたいが自動候補化(status='interested'への反映)はしたくない、という用途を想定。
ALTER TABLE screening_rules
    ADD COLUMN rule_purpose ENUM('candidate', 'entry_timing', 'loss_cut', 'profit_taking')
        NOT NULL DEFAULT 'candidate' COMMENT 'ルールの用途区分' AFTER group_id;

ALTER TABLE screening_groups
    ADD COLUMN candidate_screening_active BOOLEAN NOT NULL DEFAULT TRUE
        COMMENT '候補スクリーニング部分のみの有効/無効(is_activeとは別軸)' AFTER is_default;
