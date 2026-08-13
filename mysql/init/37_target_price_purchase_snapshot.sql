-- ターゲットプライス自動算出値(target_price_auto)は表示のたびに現在値ベースで
-- 再計算されるため、株価が大きく下落した銘柄では目標株価も一緒に下がってしまい、
-- 利確判定の基準として使うと「下落した分だけ達成率が上がる」誤った挙動になる。
-- purchase_score/purchase_priceと同様に、買付時点の値をスナップショットとして
-- 保持し、保有銘柄の利確判定はこちらを優先して使う。
-- target_price_auto_logic/target_price_at_purchase_logicは、どのロジック
-- (eps_growth/pbr_normalization/analyst_consensus)で算出されたかを記録し、
-- 画面上で算出根拠を表示できるようにする。
ALTER TABLE user_stock_status
    ADD COLUMN target_price_at_purchase DECIMAL(15, 2) NULL COMMENT '購入時点で算出したターゲットプライス(以降固定)' AFTER target_price_manual,
    ADD COLUMN target_price_auto_logic ENUM('eps_growth', 'pbr_normalization', 'analyst_consensus') NULL COMMENT 'target_price_autoの算出ロジック' AFTER target_price_at_purchase,
    ADD COLUMN target_price_at_purchase_logic ENUM('eps_growth', 'pbr_normalization', 'analyst_consensus') NULL COMMENT 'target_price_at_purchaseの算出ロジック' AFTER target_price_auto_logic;
