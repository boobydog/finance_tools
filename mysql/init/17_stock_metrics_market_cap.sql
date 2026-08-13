-- 旧screen_conditions.json変換ルール(market_cap)を評価できるようにするため追加
ALTER TABLE stock_metrics ADD COLUMN market_cap BIGINT COMMENT '時価総額(円)' AFTER pbr;
