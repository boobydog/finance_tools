-- 損切りライン(drawdown_percent)を、グループ一律の固定値ではなく、
-- 銘柄自身のヒストリカル・ボラティリティ(HV)に対する倍率に切り替える。
-- 「値動きの大きい成長株には広め(15〜20%)、安定した銘柄には10%未満」という
-- 目安と、想定されるHV水準(成長株35〜45%程度、安定株15〜20%程度)から逆算すると
-- 倍率0.5前後が妥当なため、これまでの固定値(-10〜-20%)は撤回し、
-- 全グループで一律 -0.5×HV に統一する(グループごとの個性は他の項目や
-- 手動での倍率調整で表現できるよう、value_mode/min_thresholdは引き続き
-- グループ単位で編集可能)。
UPDATE screening_rules
SET value_mode = 'hv_multiplier', min_threshold = -0.5
WHERE rule_purpose = 'loss_cut' AND category = 'A' AND param_key = 'drawdown_percent';
