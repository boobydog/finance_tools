SELECT tier_id, max_trade_value, commission
FROM trading_fee_tiers
ORDER BY (max_trade_value IS NULL), max_trade_value;
