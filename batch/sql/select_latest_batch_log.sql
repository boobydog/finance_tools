SELECT log_id, status, retry_count, updated_at
FROM batch_logs
WHERE process_name = :process_name
ORDER BY log_id DESC
LIMIT 1;
