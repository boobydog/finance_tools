-- 「検討」ステータスを追加する。既存の「候補」(interested、候補スクリーニングが自動付与)
-- とは独立した手動ステータスで、ユーザーが「これは買う前提でじっくり検討したい」と
-- 明示的にマークするためのもの。候補スクリーニング(系統A/B)はstatus IS NULLの銘柄しか
-- 評価しないため、検討ステータスの銘柄は自動候補化の対象から外れる(既存のexcluded等と同様)。
ALTER TABLE user_stock_status
    MODIFY COLUMN status ENUM('interested', 'holding', 'sold', 'excluded', 'considering') COMMENT 'ステータス';
