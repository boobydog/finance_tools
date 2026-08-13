-- 削除不可のデフォルトグループ(is_default=TRUE)は対象外。
DELETE FROM screening_groups WHERE is_default = FALSE;
