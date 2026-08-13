-- 決算発表日+翌日の個別更新をトリガーするため、次回決算発表予定日を保持する。
ALTER TABLE stock_metrics ADD COLUMN next_earnings_date DATE COMMENT '次回決算発表予定日' AFTER operating_cf;
