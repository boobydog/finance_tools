-- PEGレシオ(ピーター・リンチ流の候補スクリーニングに必須の指標)を追加する。
-- forward_per ÷ eps_growth で算出できる派生値のため、新規カラムは追加せず、
-- 候補スクリーニングのクエリ側(select_stocks_with_metrics_untouched.sql)で
-- 都度計算する(is_above_ma25/drawdown_percent等の既存の派生値と同じ方式)。
-- eps_growthが0以下の場合はPEGが定義できない(除算不能・符号が無意味)ため、
-- クエリ側でNULLにフォールバックし、判定不能としてスキップされるようにする。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('peg_ratio', 'PEGレシオ', 'number', 0, 100, '倍', 'forward_per ÷ eps_growth。1以下で割安とされる(ピーター・リンチの基準)。eps_growthが0以下の銘柄はNULL(判定不能)');
