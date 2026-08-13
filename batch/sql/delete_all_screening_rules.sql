-- JSON総入れ替えの対象は候補スクリーニング用ルールのみ。買入タイミング/損切り/利確用
-- ルールと、削除不可のデフォルトグループのルールは対象外(消さない)。
DELETE FROM screening_rules
WHERE rule_purpose = 'candidate'
  AND group_id IN (SELECT group_id FROM screening_groups WHERE is_default = FALSE);
