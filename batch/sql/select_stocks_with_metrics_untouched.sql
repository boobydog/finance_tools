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
    m.free_cash_flow,
    -- PEGレシオ(派生値): eps_growthが0以下だと除算が無意味(符号反転・ゼロ除算)になるため、
    -- その場合はNULL(判定不能)として扱う。
    CASE WHEN m.eps_growth > 0 THEN m.forward_per / m.eps_growth ELSE NULL END AS peg_ratio,
    m.revenue_cagr_5y,
    m.net_income_cagr_5y,
    m.consecutive_revenue_growth_years,
    m.consecutive_profit_years,
    m.relative_strength,
    m.rsi,
    m.volume_ratio,
    m.hv
FROM stocks s
JOIN stock_metrics m ON m.ticker_symbol = s.ticker_symbol
LEFT JOIN user_stock_status u ON u.ticker_symbol = s.ticker_symbol
WHERE u.status IS NULL;
