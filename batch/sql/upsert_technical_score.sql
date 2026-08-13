INSERT INTO technical_scores (
    ticker_symbol, total_score, stage2_score, rs_score, volume_score, rsi_score, vcp_score
) VALUES (
    :ticker_symbol, :total_score, :stage2_score, :rs_score, :volume_score, :rsi_score, :vcp_score
)
ON DUPLICATE KEY UPDATE
    total_score = VALUES(total_score),
    stage2_score = VALUES(stage2_score),
    rs_score = VALUES(rs_score),
    volume_score = VALUES(volume_score),
    rsi_score = VALUES(rsi_score),
    vcp_score = VALUES(vcp_score);
