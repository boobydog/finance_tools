-- 購入記録に口座種別(特定口座(源泉徴収あり)/一般口座 or NISA口座)を追加する。
-- 損切り・利確判定画面で、保有中銘柄の直近の購入記録の口座種別を参照し、
-- NISA口座であれば譲渡益課税・売買手数料を反映しない(非課税・手数料無料として扱う)。
ALTER TABLE trade_history
    ADD COLUMN account_type ENUM('taxable', 'nisa') NOT NULL DEFAULT 'taxable'
    COMMENT '口座種別(taxable=特定口座(源泉徴収あり)/一般口座、nisa=NISA口座)'
    AFTER memo;
