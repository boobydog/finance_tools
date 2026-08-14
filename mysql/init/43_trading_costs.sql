-- 利確判定で、売買手数料・譲渡益課税を考慮した「手数料・税引後の損益」を
-- 計算できるようにする。証券会社によって手数料体系が異なるため、DBの
-- テーブルで管理し、設定画面から編集できるようにする(設定ファイルではなくDB管理とする。
-- 他の設定項目(app_settings/screening_rules等)と同じくDBに一元化した方が、
-- 画面からの編集・即時反映という既存の設計方針と一貫するため)。

-- 売買手数料(片道)を、約定代金の金額帯(ティア)ごとに定義する。
-- max_trade_valueがNULLの行は「上限なし(最上位ティア)」を意味する。
CREATE TABLE trading_fee_tiers (
    tier_id          INT           NOT NULL AUTO_INCREMENT COMMENT 'ティアID',
    max_trade_value  DECIMAL(15,2) NULL COMMENT 'この約定代金(円)以下に適用。NULLは上限なし',
    commission       DECIMAL(10,2) NOT NULL COMMENT '片道手数料(円、税込)',
    PRIMARY KEY (tier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初期値: SBI証券 現物取引「スタンダードプラン」の手数料(税込)を参考に設定。
-- 実際の金額は証券会社・プラン(SBI証券は条件を満たすと0円になる「ゼロ革命」等もある)や
-- 改定によって変わるため、必ず利用中の証券会社の最新の手数料表と照合し、
-- 設定画面(取引コスト設定)から実態に合わせて調整すること。
INSERT INTO trading_fee_tiers (max_trade_value, commission) VALUES
    (50000,     55),
    (100000,    99),
    (200000,    115),
    (500000,    275),
    (1000000,   535),
    (1500000,   640),
    (30000000,  1013),
    (NULL,      1070);

-- 譲渡益課税の税率(%)。特定口座(源泉徴収あり)/一般口座の申告分離課税の
-- 標準税率(所得税15.315% + 住民税5%)を初期値とする。NISA口座等、非課税の場合は
-- 設定画面で0に変更すること。
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('capital_gains_tax_rate', '20.315');
