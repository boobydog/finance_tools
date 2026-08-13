SELECT rule_id, group_id, rule_purpose, category, param_key, operator, value_mode, min_threshold
FROM screening_rules
WHERE group_id IS NOT NULL
ORDER BY group_id, rule_id;
