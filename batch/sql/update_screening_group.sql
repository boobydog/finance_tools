UPDATE screening_groups
SET name = :name, description = :description, signal_count_threshold = :signal_count_threshold,
    holding_period_exit_days = :holding_period_exit_days
WHERE group_id = :group_id;
