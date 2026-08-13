UPDATE batch_logs
SET status = :status,
    error_message = :error_message
WHERE log_id = :log_id;
