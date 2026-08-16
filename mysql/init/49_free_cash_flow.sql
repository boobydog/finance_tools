-- フリーキャッシュフロー(FCF、バフェット流の候補スクリーニングで重視される指標)を追加する。
-- 営業CFとCapExを自前で減算すると、yfinanceのCapExがマイナス表記(既存のoperating_cfは
-- プラス表記の慣習)であるため符号を誤って反転させるバグを生みやすい。そのため自前計算は
-- 行わず、yfinanceが既に符号を正しく確定させて算出済みのinfo["freeCashflow"]をそのまま
-- 採用する(追加のAPI呼び出しも発生しない、既存のinfo取得に含まれるフィールドのため)。
ALTER TABLE stock_metrics ADD COLUMN free_cash_flow BIGINT COMMENT 'フリーキャッシュフロー(百万円、yfinance算出値をそのまま採用)' AFTER operating_cf;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('free_cash_flow', 'フリーキャッシュフロー', 'number', NULL, NULL, '百万円', '営業CFから設備投資額を差し引いた自由に使える現金(yfinance算出値)');
