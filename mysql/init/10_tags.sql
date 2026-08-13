-- 銘柄への自由なタグ付け用マスタ
CREATE TABLE tags (
    tag_id  INT         NOT NULL AUTO_INCREMENT COMMENT 'タグID',
    name    VARCHAR(50) NOT NULL COMMENT 'タグ名',
    color   VARCHAR(7)           COMMENT '表示色 (#rrggbb)',
    PRIMARY KEY (tag_id),
    UNIQUE KEY uq_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
