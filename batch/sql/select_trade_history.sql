SELECT
    th.trade_id,
    th.ticker_symbol,
    th.action,
    th.price,
    th.quantity,
    th.traded_at,
    th.screening_group_id,
    sg.name AS screening_group_name,
    th.memo,
    th.account_type
FROM trade_history th
LEFT JOIN screening_groups sg ON sg.group_id = th.screening_group_id
ORDER BY th.traded_at DESC;
