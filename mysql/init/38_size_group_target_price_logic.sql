-- 小型株/中型株/大型株グループのターゲットプライス自動算出ロジックを明示的に指定する。
-- 大型株: アナリストカバレッジが厚く、コンセンサス予想が最も客観的で信頼できるため
--   analyst_consensusを優先(既定の優先順でも最優先だが、意図を明示するため設定)。
-- 中型株: 同様にアナリストコンセンサスを優先(大型株ほどではないがカバレッジは一定数ある)。
-- 小型株: アナリストカバレッジが薄く、target_mean_priceが取得できない銘柄が多いため、
--   同グループの候補基準(高い売上成長率・ROEを要求)とも整合するeps_growthを優先する。
UPDATE screening_groups SET auto_calc_logic_type = 'eps_growth' WHERE group_id = 6;       -- 小型株
UPDATE screening_groups SET auto_calc_logic_type = 'analyst_consensus' WHERE group_id = 7; -- 中型株
UPDATE screening_groups SET auto_calc_logic_type = 'analyst_consensus' WHERE group_id = 8; -- 大型株
