-- UIの「除外」タブに対応するステータスを追加
ALTER TABLE user_stock_status
    MODIFY COLUMN status ENUM('interested', 'holding', 'sold', 'excluded') COMMENT 'ステータス';
