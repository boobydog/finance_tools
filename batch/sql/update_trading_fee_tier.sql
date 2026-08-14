UPDATE trading_fee_tiers
SET max_trade_value = :max_trade_value, commission = :commission
WHERE tier_id = :tier_id;
