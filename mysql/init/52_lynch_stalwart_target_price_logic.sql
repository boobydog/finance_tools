-- リンチ流・優良安定株(ステーブラー)は、中型株・大型株グループと同様にアナリスト
-- コンセンサスベースの目標株価ロジックを優先する(急成長株グループのeps_growthベースとは
-- 異なり、安定成長企業は市場コンセンサスの方が妥当な評価に近いと考えられるため)。
UPDATE screening_groups SET auto_calc_logic_type = 'analyst_consensus' WHERE group_id = 15;
