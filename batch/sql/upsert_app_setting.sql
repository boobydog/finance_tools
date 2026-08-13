INSERT INTO app_settings (setting_key, setting_value)
VALUES (:setting_key, :setting_value)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
