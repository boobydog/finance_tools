SELECT group_id, name, description, is_active, purpose, is_default, candidate_screening_active, signal_count_threshold, holding_period_exit_days, trailing_stop_allowance_percent
FROM screening_groups ORDER BY group_id;
