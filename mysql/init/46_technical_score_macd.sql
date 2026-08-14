-- テクニカルスコアに第6の要素「MACD上昇モメンタム」を追加する。
-- 既存の5要素(Stage2=トレンド構造/RS=相対強度/出来高急増/RSI=オシレーター/VCP=52週高値圏)を
-- 補完する、移動平均収束拡散(MACD)によるモメンタム転換の確認シグナル。
-- 配点・期間等の計算パラメータはapp_settingsテーブル(technical_score_*キー)で管理し、
-- 設定画面(テクニカルスコア設定)から編集できる(既存の5要素分の設定キーも同様)。
ALTER TABLE technical_scores
    ADD COLUMN macd_score INT COMMENT 'MACD上昇モメンタムスコア' AFTER vcp_score;
