SELECT log_id, process_name, status, retry_count, error_message, created_at, updated_at
FROM batch_logs
ORDER BY log_id DESC
LIMIT 50;
