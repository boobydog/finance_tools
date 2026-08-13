-- ローソク足チャートには始値が必要なため追加する。
ALTER TABLE daily_stock_data ADD COLUMN open_price DECIMAL(15, 2) COMMENT '始値' AFTER date;
