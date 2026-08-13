-- 決算発表日、またはその翌日にあたる銘柄を抽出する(財務諸表の即時更新対象)。
SELECT ticker_symbol
FROM stock_metrics
WHERE next_earnings_date = CURDATE()
   OR next_earnings_date = CURDATE() - INTERVAL 1 DAY;
