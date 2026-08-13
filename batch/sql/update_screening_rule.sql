UPDATE screening_rules
SET rule_purpose = :rule_purpose, category = :category, param_key = :param_key, operator = :operator, value_mode = :value_mode, min_threshold = :param_value
WHERE rule_id = :rule_id;
