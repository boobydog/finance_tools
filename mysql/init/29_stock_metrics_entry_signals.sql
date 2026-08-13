-- 買入タイミング判定画面向けのシグナル指標を追加する。
-- ma25: トレンド転換確認(現在値がma25を上回っているか)用の25日移動平均。
-- earnings_surprise_percent: 直近決算の市場予想(コンセンサス)との乖離率(%)。
ALTER TABLE stock_metrics
    ADD COLUMN ma25 DECIMAL(15, 2) NULL COMMENT '25日移動平均' AFTER volume_ratio,
    ADD COLUMN earnings_surprise_percent DECIMAL(10, 4) NULL COMMENT '直近決算の市場予想乖離率(%)' AFTER next_earnings_date;
