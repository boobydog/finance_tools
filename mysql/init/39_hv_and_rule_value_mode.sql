-- 銘柄別のヒストリカル・ボラティリティ(HV)を追加する。60日間の日次リターンの
-- 標準偏差を年率換算(√250倍)した値(%)。他の技術指標(RS/RSI/出来高倍率/MA25)と
-- 同じ価格キャッシュ(daily_stock_data)から計算するため、高速な技術指標取得の
-- 一部として毎回のパイプライン実行時に更新する。
ALTER TABLE stock_metrics
    ADD COLUMN hv DECIMAL(10, 4) NULL COMMENT 'ヒストリカル・ボラティリティ(年率換算,%)' AFTER volume_ratio;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('hv', 'ヒストリカルボラティリティ(HV)', 'number', 0, 500, '%', '60日間の日次リターン標準偏差を年率換算した値動きの振れ幅');

-- ルールの閾値(min_threshold)を「固定値」として使うか、「銘柄自身のHVに対する倍率」
-- として使うかを切り替えられるようにする。hv_multiplierの場合、実際の比較に使う
-- 閾値は min_threshold × その銘柄のHV として判定エンジンが計算する
-- (例: min_threshold=-0.5, HV=40% の銘柄なら、実際の損切りラインは-20%になる)。
ALTER TABLE screening_rules
    ADD COLUMN value_mode ENUM('fixed', 'hv_multiplier') NOT NULL DEFAULT 'fixed' COMMENT '閾値の解釈方法' AFTER operator;
