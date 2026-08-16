INSERT INTO stock_metrics (
    ticker_symbol, forward_per, pbr, bps, target_mean_price, market_cap, dividend_yield, equity_ratio, roe,
    eps_growth, operating_profit_yoy, operating_margin, revenue_yoy, operating_cf, free_cash_flow,
    next_earnings_date, earnings_surprise_percent
) VALUES (
    :ticker_symbol, :forward_per, :pbr, :bps, :target_mean_price, :market_cap, :dividend_yield, :equity_ratio, :roe,
    :eps_growth, :operating_profit_yoy, :operating_margin, :revenue_yoy, :operating_cf, :free_cash_flow,
    :next_earnings_date, :earnings_surprise_percent
)
ON DUPLICATE KEY UPDATE
    forward_per = VALUES(forward_per),
    pbr = VALUES(pbr),
    bps = VALUES(bps),
    target_mean_price = VALUES(target_mean_price),
    market_cap = VALUES(market_cap),
    dividend_yield = VALUES(dividend_yield),
    equity_ratio = VALUES(equity_ratio),
    roe = VALUES(roe),
    eps_growth = VALUES(eps_growth),
    operating_profit_yoy = VALUES(operating_profit_yoy),
    operating_margin = VALUES(operating_margin),
    revenue_yoy = VALUES(revenue_yoy),
    operating_cf = VALUES(operating_cf),
    free_cash_flow = VALUES(free_cash_flow),
    next_earnings_date = VALUES(next_earnings_date),
    earnings_surprise_percent = VALUES(earnings_surprise_percent);
