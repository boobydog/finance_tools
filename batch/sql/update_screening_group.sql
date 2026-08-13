UPDATE screening_groups
SET name = :name, description = :description, signal_count_threshold = :signal_count_threshold
WHERE group_id = :group_id;
