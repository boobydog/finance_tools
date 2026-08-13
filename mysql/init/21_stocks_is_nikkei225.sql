-- 銘柄管理は日経225構成銘柄のみを対象として運用するため、
-- 全銘柄一覧(JPXインポート由来)からフィルタするためのフラグを追加する。
ALTER TABLE stocks ADD COLUMN is_nikkei225 BOOLEAN NOT NULL DEFAULT FALSE COMMENT '日経225構成銘柄フラグ' AFTER sector;
