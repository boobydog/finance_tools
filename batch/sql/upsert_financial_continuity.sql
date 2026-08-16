INSERT INTO stock_metrics (
    ticker_symbol, revenue_cagr_5y, net_income_cagr_5y, consecutive_revenue_growth_years, consecutive_profit_years
) VALUES (
    :ticker_symbol, :revenue_cagr_5y, :net_income_cagr_5y, :consecutive_revenue_growth_years, :consecutive_profit_years
)
ON DUPLICATE KEY UPDATE
    revenue_cagr_5y = VALUES(revenue_cagr_5y),
    net_income_cagr_5y = VALUES(net_income_cagr_5y),
    consecutive_revenue_growth_years = VALUES(consecutive_revenue_growth_years),
    consecutive_profit_years = VALUES(consecutive_profit_years);
