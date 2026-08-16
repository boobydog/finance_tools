-- バフェット流・優良株は「割安さ」(純資産に対する株価の妥当性)を重視するため、
-- PBR正常化ベース(BPS×ターゲットPBR)を優先ロジックとする(モメンタム系グループが使う
-- eps_growthベースとは異なり、成長率ではなく資産価値を基準にする)。
UPDATE screening_groups SET auto_calc_logic_type = 'pbr_normalization' WHERE group_id = 13;

-- リンチ流・急成長株は「成長を織り込んだ適正株価」を重視するため、EPS成長率ベースを
-- 優先ロジックとする(小型株グループと同じロジック)。
UPDATE screening_groups SET auto_calc_logic_type = 'eps_growth' WHERE group_id = 14;
