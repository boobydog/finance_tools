-- 取引時間外用(複数銘柄): yfinanceを叩かず、日次キャッシュからまとめて返す。
WITH ranked AS (
    SELECT
        ticker_symbol, open_price, close_price, high_price, low_price,
        ROW_NUMBER() OVER (PARTITION BY ticker_symbol ORDER BY date DESC) AS rn
    FROM daily_stock_data
    WHERE ticker_symbol IN :ticker_symbols
)
SELECT
    ticker_symbol,
    MAX(CASE WHEN rn = 1 THEN open_price END) AS open_price,
    MAX(CASE WHEN rn = 1 THEN close_price END) AS latest_close,
    MAX(CASE WHEN rn = 1 THEN high_price END) AS day_high,
    MAX(CASE WHEN rn = 1 THEN low_price END) AS day_low,
    MAX(CASE WHEN rn = 2 THEN close_price END) AS previous_close
FROM ranked
WHERE rn IN (1, 2)
GROUP BY ticker_symbol;
