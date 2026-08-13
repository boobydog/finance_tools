-- 利確判定画面のトレイリングストップ計算に使う、保有期間中の最高値を保持する。
ALTER TABLE user_stock_status
    ADD COLUMN highest_price_since_purchase DECIMAL(15, 2) NULL COMMENT '保有期間中の最高値(トレイリングストップ用)';
