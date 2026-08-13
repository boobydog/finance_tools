UPDATE screening_groups
SET candidate_screening_active = :candidate_screening_active
WHERE group_id = :group_id;
