-- スクリーニンググループを用途(エントリー/損切り/利確)で区別できるようにする。
-- 既存グループは全てエントリー用として扱う。
ALTER TABLE screening_groups
    ADD COLUMN purpose ENUM('entry', 'loss_cut', 'profit_taking') NOT NULL DEFAULT 'entry' COMMENT '用途' AFTER is_active,
    ADD COLUMN auto_calc_logic_type ENUM('eps_growth', 'pbr_normalization', 'analyst_consensus') NULL
        COMMENT 'ターゲットプライス自動算出ロジック' AFTER purpose;
