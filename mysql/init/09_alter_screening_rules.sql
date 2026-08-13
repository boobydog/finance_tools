-- screening_rulesをグループ単位で管理できるように拡張し、
-- 判定対象パラメータ(param_key)と比較演算子(operator)を明示的なカラムとして持たせる。
-- (元のrule_metadata JSONは追加パラメータ(キーワード等)専用として残す)
ALTER TABLE screening_rules
    ADD COLUMN group_id  INT NULL COMMENT 'スクリーニンググループID' AFTER rule_id,
    ADD COLUMN param_key VARCHAR(100) NULL COMMENT '判定対象パラメータ名 (PER, 自己資本比率 等)' AFTER category,
    ADD COLUMN operator  ENUM('gte', 'lte', 'eq') NULL COMMENT '比較演算子' AFTER param_key,
    ADD CONSTRAINT fk_screening_rules_group_id
        FOREIGN KEY (group_id) REFERENCES screening_groups (group_id);
