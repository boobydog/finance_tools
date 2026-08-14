-- 利確判定画面向け: 保有中(holding)銘柄の目標達成度・過熱感・トレイリングストップ関連指標を返す。
-- purchase_price/quantityは複数回の買い増し・部分売却を集計した値(口座種別問わず)。
-- purchase_dateはポジションを開いた最初の購入日(保有期間の起点)。
-- 口座種別ごとの内訳(手数料・税引後損益の計算用)はselect_position_lots.sqlで別途取得する。
SELECT
    s.ticker_symbol,
    s.name,
    s.sector,
    d.close_price AS current_price,
    u.target_price_auto,
    u.target_price_manual,
    u.target_price_at_purchase,
    u.target_price_auto_logic,
    u.target_price_at_purchase_logic,
    u.highest_price_since_purchase,
    m.forward_per,
    m.hv,
    m.ma25,
    buy.purchase_price,
    buy.quantity,
    buy.purchase_date
FROM stocks s
JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
LEFT JOIN stock_metrics m ON m.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT d1.ticker_symbol, d1.close_price
    FROM daily_stock_data d1
    INNER JOIN (
        SELECT ticker_symbol, MAX(date) AS max_date FROM daily_stock_data GROUP BY ticker_symbol
    ) d2 ON d1.ticker_symbol = d2.ticker_symbol AND d1.date = d2.max_date
) d ON d.ticker_symbol = s.ticker_symbol
LEFT JOIN (
    SELECT
        ticker_symbol,
        SUM(CASE WHEN action = 'buy' THEN quantity ELSE -quantity END) AS quantity,
        SUM(CASE WHEN action = 'buy' THEN price * quantity ELSE 0 END)
            / NULLIF(SUM(CASE WHEN action = 'buy' THEN quantity ELSE 0 END), 0) AS purchase_price,
        MIN(CASE WHEN action = 'buy' THEN traded_at END) AS purchase_date
    FROM trade_history
    GROUP BY ticker_symbol
) buy ON buy.ticker_symbol = s.ticker_symbol
WHERE u.status = 'holding'
ORDER BY s.ticker_symbol;
