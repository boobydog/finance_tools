-- テクニカルスコアリング(VCP判定のATR計算等)にHigh/Lowが必要なため追加。
-- あわせて、このテーブルを株価履歴のローカルキャッシュとして使い、
-- 2回目以降は差分(前回保存日の翌日以降)のみyfinanceから取得するようにする。
ALTER TABLE daily_stock_data
    ADD COLUMN high_price DECIMAL(15, 2) COMMENT '高値' AFTER close_price,
    ADD COLUMN low_price DECIMAL(15, 2) COMMENT '安値' AFTER high_price;
