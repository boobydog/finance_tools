INSERT INTO stock_metrics (ticker_symbol, relative_strength, rsi, volume_ratio, hv, ma25, ma25_above_streak_days)
VALUES (:ticker_symbol, :relative_strength, :rsi, :volume_ratio, :hv, :ma25, :ma25_above_streak_days)
ON DUPLICATE KEY UPDATE
    relative_strength = VALUES(relative_strength),
    rsi = VALUES(rsi),
    volume_ratio = VALUES(volume_ratio),
    hv = VALUES(hv),
    ma25 = VALUES(ma25),
    ma25_above_streak_days = VALUES(ma25_above_streak_days);
