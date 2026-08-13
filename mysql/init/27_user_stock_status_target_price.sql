-- 損切り判定用の購入時スコアと、利確判定用のターゲットプライス(自動算出/手動上書き)を保持する。
ALTER TABLE user_stock_status
    ADD COLUMN purchase_score DECIMAL(10, 4) NULL COMMENT '購入時点のテクニカルスコア',
    ADD COLUMN target_price_auto DECIMAL(15, 2) NULL COMMENT 'システム自動算出のターゲットプライス',
    ADD COLUMN target_price_manual DECIMAL(15, 2) NULL COMMENT 'ユーザー手動入力のターゲットプライス(設定時は自動算出より優先)';
