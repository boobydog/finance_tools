-- ターゲットプライス自動算出に使う指標を追加する。
-- bps: PBR正常化モデル(ロジックB)用の1株当たり純資産。
-- target_mean_price: アナリストコンセンサスモデル(ロジックC)用の目標株価平均。
ALTER TABLE stock_metrics
    ADD COLUMN bps DECIMAL(15, 4) NULL COMMENT '1株当たり純資産(BPS)' AFTER pbr,
    ADD COLUMN target_mean_price DECIMAL(15, 2) NULL COMMENT 'アナリスト目標株価平均' AFTER bps;
