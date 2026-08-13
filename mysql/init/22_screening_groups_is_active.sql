-- グループ単位で有効/無効を切り替え、判定エンジンの対象から一時的に除外できるようにする。
ALTER TABLE screening_groups ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効/無効フラグ' AFTER description;
