INSERT INTO financial_results (
    ticker_symbol, fiscal_period, revenue, net_income, eps, equity_ratio, roe, operating_cf
) VALUES (
    :ticker_symbol, :fiscal_period, :revenue, :net_income, :eps, :equity_ratio, :roe, :operating_cf
)
ON DUPLICATE KEY UPDATE
    revenue = VALUES(revenue),
    net_income = VALUES(net_income),
    eps = VALUES(eps),
    equity_ratio = VALUES(equity_ratio),
    roe = VALUES(roe),
    operating_cf = VALUES(operating_cf);
