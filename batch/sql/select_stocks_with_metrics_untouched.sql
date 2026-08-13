SELECT
    s.ticker_symbol,
    s.is_under_supervision,
    s.is_delisting_risk,
    m.forward_per,
    m.pbr,
    m.market_cap,
    m.dividend_yield,
    m.equity_ratio,
    m.roe,
    m.eps_growth,
    m.operating_profit_yoy,
    m.operating_margin,
    m.revenue_yoy,
    m.operating_cf,
    m.relative_strength,
    m.rsi,
    m.volume_ratio,
    m.hv
FROM stocks s
JOIN stock_metrics m ON m.ticker_symbol = s.ticker_symbol
LEFT JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
WHERE u.status IS NULL;
