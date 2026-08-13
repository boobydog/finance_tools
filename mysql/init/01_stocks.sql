-- 銘柄基本情報
CREATE TABLE stocks (
    ticker_symbol         VARCHAR(10)  NOT NULL COMMENT '証券コード',
    name                  VARCHAR(255) NOT NULL COMMENT '銘柄名',
    market_segment        VARCHAR(50)           COMMENT '市場区分',
    sector                VARCHAR(100)          COMMENT '業種',
    is_under_supervision  BOOLEAN      NOT NULL DEFAULT FALSE COMMENT '監理銘柄フラグ',
    is_delisting_risk     BOOLEAN      NOT NULL DEFAULT FALSE COMMENT '上場廃止リスク（基準不適合等）',
    PRIMARY KEY (ticker_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
