SELECT st.ticker_symbol, t.tag_id, t.name, t.color
FROM stock_tags st
JOIN tags t ON t.tag_id = st.tag_id
WHERE NOT EXISTS (
    SELECT 1 FROM screening_groups g
    WHERE g.name = t.name AND g.is_active = FALSE
);
