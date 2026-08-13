-- 「小型株」グループでROE上限213.6%を指定したいというユーザー要望に合わせ、
-- バリデーション上限を拡張する。
UPDATE screening_param_definitions SET max_value = 300 WHERE param_key = 'roe';
