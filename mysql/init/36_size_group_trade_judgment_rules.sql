-- 小型株/中型株/大型株の各グループに、買入タイミング/損切り判定/利確判定のルールを設定する。
-- 項目(param_key)はデフォルトグループと同じだが、閾値は各セグメントのボラティリティ・
-- バリュエーション水準の違いを踏まえて調整する(値の根拠は下記コメント参照)。
--
-- 出来高急増(volume_ratio): 個人投資家向けの一般的な目安は「20日平均出来高の3倍以上」。
--   流動性が低くノイズの多い小型株はこの基準に近い3.0倍、流動性が高く出来高が
--   安定している大型株は2.0倍(デフォルトと同水準)でも十分意味のあるシグナルとする。
-- 損切りライン(drawdown_percent): 値動きの大きい成長株には広め(15〜20%)、
--   安定したディフェンシブ銘柄には10%未満が目安とされる。小型株はボラティリティが
--   高いため-20%、大型株(安定性重視)は-10%、中型株はデフォルトと同じ-15%とする。
-- スコア差分(score_diff): 損切りラインと同様の考え方でセグメント別に幅を調整
--   (小型株-25pt、中型株-20pt、大型株-15pt)。
-- 過熱感PER(forward_per): 市場平均PERはTOPIXで16〜17倍程度、グロース株は20倍以上、
--   時価総額の大きいグロース銘柄でも50〜100倍超まで許容されるとされる。
--   成長期待の高い小型株は65倍、中型株は45倍、安定性重視の大型株は30倍を過熱の目安とする。
-- それ以外(MA25上抜け・決算サプライズ・上場廃止/監理リスク・業績悪化・
-- ターゲットプライス達成度・トレイリングストップ発動)はセグメントに依らない
-- 普遍的な基準のため、デフォルトグループと同じ値を使う。

UPDATE screening_groups SET signal_count_threshold = 2 WHERE group_id IN (6, 7, 8);

-- 小型株(group_id=6)
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, min_threshold) VALUES
    (6, 'entry_timing', 'C', 'is_above_ma25', 'eq', 1),
    (6, 'entry_timing', 'C', 'volume_ratio', 'gte', 3.0),
    (6, 'entry_timing', 'C', 'earnings_surprise_percent', 'gte', 0),
    (6, 'loss_cut', 'A', 'is_delisting_risk', 'eq', 1),
    (6, 'loss_cut', 'A', 'is_under_supervision', 'eq', 1),
    (6, 'loss_cut', 'A', 'drawdown_percent', 'lte', -20),
    (6, 'loss_cut', 'B', 'operating_profit_yoy', 'lte', 0),
    (6, 'loss_cut', 'B', 'eps_growth', 'lte', 0),
    (6, 'loss_cut', 'B', 'score_diff', 'lte', -25),
    (6, 'profit_taking', 'A', 'achievement_percent', 'gte', 100),
    (6, 'profit_taking', 'A', 'forward_per', 'gte', 65),
    (6, 'profit_taking', 'A', 'is_trailing_stop_triggered', 'eq', 1);

-- 中型株(group_id=7)
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, min_threshold) VALUES
    (7, 'entry_timing', 'C', 'is_above_ma25', 'eq', 1),
    (7, 'entry_timing', 'C', 'volume_ratio', 'gte', 2.5),
    (7, 'entry_timing', 'C', 'earnings_surprise_percent', 'gte', 0),
    (7, 'loss_cut', 'A', 'is_delisting_risk', 'eq', 1),
    (7, 'loss_cut', 'A', 'is_under_supervision', 'eq', 1),
    (7, 'loss_cut', 'A', 'drawdown_percent', 'lte', -15),
    (7, 'loss_cut', 'B', 'operating_profit_yoy', 'lte', 0),
    (7, 'loss_cut', 'B', 'eps_growth', 'lte', 0),
    (7, 'loss_cut', 'B', 'score_diff', 'lte', -20),
    (7, 'profit_taking', 'A', 'achievement_percent', 'gte', 100),
    (7, 'profit_taking', 'A', 'forward_per', 'gte', 45),
    (7, 'profit_taking', 'A', 'is_trailing_stop_triggered', 'eq', 1);

-- 大型株(group_id=8)
INSERT INTO screening_rules (group_id, rule_purpose, category, param_key, operator, min_threshold) VALUES
    (8, 'entry_timing', 'C', 'is_above_ma25', 'eq', 1),
    (8, 'entry_timing', 'C', 'volume_ratio', 'gte', 2.0),
    (8, 'entry_timing', 'C', 'earnings_surprise_percent', 'gte', 0),
    (8, 'loss_cut', 'A', 'is_delisting_risk', 'eq', 1),
    (8, 'loss_cut', 'A', 'is_under_supervision', 'eq', 1),
    (8, 'loss_cut', 'A', 'drawdown_percent', 'lte', -10),
    (8, 'loss_cut', 'B', 'operating_profit_yoy', 'lte', 0),
    (8, 'loss_cut', 'B', 'eps_growth', 'lte', 0),
    (8, 'loss_cut', 'B', 'score_diff', 'lte', -15),
    (8, 'profit_taking', 'A', 'achievement_percent', 'gte', 100),
    (8, 'profit_taking', 'A', 'forward_per', 'gte', 30),
    (8, 'profit_taking', 'A', 'is_trailing_stop_triggered', 'eq', 1);
