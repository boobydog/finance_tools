# データベーススキーマ

MySQL 8.4。全テーブル `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`。

スキーマは `mysql/init/` 配下の連番マイグレーションファイル(01〜47、新規ボリューム作成時のみ自動実行)で管理する。本ドキュメントは、それらを全て積み上げた**最終状態**を記載する。FKは明示的な`ON DELETE`/`ON UPDATE`指定がなく、すべてデフォルト(RESTRICT相当)。

ER図は [`er_diagram.puml`](er_diagram.puml) を参照。

---

## 1. `stocks` — 銘柄マスタ

追跡対象の個別銘柄(現状は日経225構成銘柄が主)。

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | — | 証券コード(例: `7203.T`)。**PK** |
| name | VARCHAR(255) | NOT NULL | — | 銘柄名 |
| market_segment | VARCHAR(50) | NULL | — | 市場区分(プライム/スタンダード/グロース等) |
| sector | VARCHAR(100) | NULL | — | 業種 |
| is_nikkei225 | BOOLEAN | NOT NULL | FALSE | 日経225構成銘柄フラグ |
| is_under_supervision | BOOLEAN | NOT NULL | FALSE | 監理銘柄フラグ |
| is_delisting_risk | BOOLEAN | NOT NULL | FALSE | 上場廃止リスク(基準不適合等) |

**PK**: ticker_symbol。FKなし(ルートエンティティ)。

---

## 2. `screening_groups` — スクリーニンググループ

判定基準を束ねる単位(小型株/中型株/大型株/デフォルト等)。

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| group_id | INT AUTO_INCREMENT | NOT NULL | — | **PK** |
| name | VARCHAR(100) | NOT NULL | — | グループ名(戦略名) |
| description | TEXT | NULL | — | 説明 |
| is_active | BOOLEAN | NOT NULL | TRUE | 有効/無効 |
| purpose | ENUM('entry','loss_cut','profit_taking') | NOT NULL | 'entry' | (レガシー、現在は`rule_purpose`に統合済み) |
| auto_calc_logic_type | ENUM('eps_growth','pbr_normalization','analyst_consensus') | NULL | — | ターゲットプライス自動算出の優先ロジック |
| is_default | BOOLEAN | NOT NULL | FALSE | フォールバックグループか(用途ごとに常に1つtrue) |
| candidate_screening_active | BOOLEAN | NOT NULL | TRUE | 候補スクリーニング部分のみの有効/無効 |
| signal_count_threshold | INT | NULL | — | 買入タイミング判定: 分類C条件の必要充足数 |
| holding_period_exit_days | INT | NULL | — | 保有期間上限(日数)。NULLは無効 |
| trailing_stop_allowance_percent | INT | NULL | — | トレイリングストップ許容下落率(%)。NULLは全体設定にフォールバック |

**PK**: group_id。FKなし(`screening_rules`/`trade_history`から参照される側)。

---

## 3. `screening_rules` — 判定ルール

1行 = 1条件。`group_id` × `rule_purpose` でグルーピングされる。

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| rule_id | INT AUTO_INCREMENT | NOT NULL | — | **PK** |
| group_id | INT | NULL | — | FK → screening_groups |
| rule_purpose | ENUM('candidate','entry_timing','loss_cut','profit_taking') | NOT NULL | 'candidate' | ルールの用途区分 |
| category | ENUM('A','B','C') | NOT NULL | — | 判定分類 |
| param_key | VARCHAR(100) | NULL | — | 対象パラメータ(`screening_param_definitions.param_key`と対応、FK制約なし) |
| operator | ENUM('gte','lte','eq') | NULL | — | 比較演算子 |
| value_mode | ENUM('fixed','hv_multiplier') | NOT NULL | 'fixed' | 閾値の解釈方法 |
| min_threshold | DECIMAL(15,4) | NULL | — | 閾値(または倍率) |
| max_threshold | DECIMAL(15,4) | NULL | — | (現状未使用、範囲指定は同一param_keyの複数行で表現) |
| rule_metadata | JSON | NULL | — | 追加パラメータ(現状未使用) |

**PK**: rule_id。**FK**: `group_id → screening_groups(group_id)`。

---

## 4. `screening_param_definitions` — パラメータ定義カタログ

ルール設定画面が選択肢として表示するための、全パラメータのメタ情報。保存値・派生値どちらも同形式で登録する。

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| param_key | VARCHAR(100) | NOT NULL | — | **PK** |
| label | VARCHAR(100) | NOT NULL | — | 画面表示名 |
| value_type | ENUM('number','string','boolean') | NOT NULL | 'number' | 値の型 |
| min_value | DECIMAL(15,4) | NULL | — | UI入力の下限目安 |
| max_value | DECIMAL(15,4) | NULL | — | UI入力の上限目安 |
| unit | VARCHAR(20) | NULL | — | 単位 |
| description | VARCHAR(255) | NULL | — | 備考 |

**PK**: param_key。FKなし(`screening_rules.param_key`から文字列で緩く参照される)。

登録が必要なパラメータの一覧は本ドキュメントでは省略する(28件、内訳は [`app/domain/`](../app/domain/) 配下の各業務ドキュメントを参照)。

---

## 5. `stock_metrics` — 銘柄別指標スナップショット

ファンダメンタルズ+テクニカル指標を1銘柄1行に集約した、判定エンジンが評価する高速参照用テーブル。バッチが定期的に上書き更新する。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK**、FK → stocks |
| forward_per | DECIMAL(15,4) | NULL | PER(予想) |
| pbr | DECIMAL(15,4) | NULL | PBR |
| bps | DECIMAL(15,4) | NULL | 1株当たり純資産(BPS) |
| target_mean_price | DECIMAL(15,2) | NULL | アナリスト目標株価平均 |
| market_cap | BIGINT | NULL | 時価総額(百万円) |
| dividend_yield | DECIMAL(10,4) | NULL | 配当利回り(%) |
| equity_ratio | DECIMAL(10,4) | NULL | 自己資本比率(%) |
| roe | DECIMAL(10,4) | NULL | ROE(%) |
| eps_growth | DECIMAL(15,4) | NULL | EPS成長率(%) |
| operating_profit_yoy | DECIMAL(15,4) | NULL | 営業利益前期比(%) |
| revenue_yoy | DECIMAL(15,4) | NULL | 売上高前期比(%) |
| operating_margin | DECIMAL(10,4) | NULL | 売上高営業利益率(%) |
| operating_cf | BIGINT | NULL | 営業CF(百万円) |
| free_cash_flow | BIGINT | NULL | フリーキャッシュフロー(百万円、yfinance算出値をそのまま採用。営業CFからCapExを自前で減算しない) |
| next_earnings_date | DATE | NULL | 次回決算発表予定日 |
| earnings_surprise_percent | DECIMAL(10,4) | NULL | 直近決算の市場予想乖離率(%) |
| relative_strength | DECIMAL(10,4) | NULL | 相対強度(RS、日経225比) |
| rsi | DECIMAL(10,4) | NULL | RSI |
| volume_ratio | DECIMAL(10,4) | NULL | 出来高倍率(20日平均比) |
| hv | DECIMAL(10,4) | NULL | ヒストリカルボラティリティ(年率換算,%) |
| ma25 | DECIMAL(15,2) | NULL | 25日移動平均 |
| ma25_above_streak_days | INT | NULL | MA25を連続で上回っている営業日数 |
| updated_at | TIMESTAMP | NOT NULL | 自動更新(ON UPDATE CURRENT_TIMESTAMP) |

**PK**: ticker_symbol。**FK**: `ticker_symbol → stocks(ticker_symbol)`。

> ⚠️ `market_cap`列のDBコメントは「円」のままだが、実際の運用単位は百万円に統一されている(マイグレーション履歴上の記述の揺れ)。実装時は百万円単位で統一すること。

---

## 6. `technical_scores` — テクニカルスコア結果

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK**、FK → stocks |
| total_score | INT | NOT NULL | 合計スコア |
| stage2_score | INT | NULL | ステージ2判定スコア |
| rs_score | INT | NULL | 相対強度(RS)スコア |
| volume_score | INT | NULL | 出来高急増スコア |
| rsi_score | INT | NULL | RSI適温ゾーンスコア |
| vcp_score | INT | NULL | VCP/52週高値圏スコア |
| macd_score | INT | NULL | MACD上昇モメンタムスコア |
| computed_at | TIMESTAMP | NOT NULL | 自動更新(ON UPDATE CURRENT_TIMESTAMP) |

**PK**: ticker_symbol。**FK**: `ticker_symbol → stocks(ticker_symbol)`。計算式のパラメータ(配点・期間・閾値)は`app_settings`の`technical_score_*`キー群で管理する(スキーマではなく設定値)。

---

## 7. `user_stock_status` — 銘柄別ユーザーステータス

ウォッチ状態・購入時スナップショット・ターゲットプライスを保持する、ユーザーのポートフォリオ管理の中核テーブル。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK**、FK → stocks |
| status | ENUM('interested','holding','sold','excluded') | NULL | ステータス |
| purchase_score | DECIMAL(10,4) | NULL | 購入時点のテクニカルスコア(以後固定) |
| target_price_auto | DECIMAL(15,2) | NULL | 自動算出のターゲットプライス(現在値ベースで都度再計算) |
| target_price_manual | DECIMAL(15,2) | NULL | 手動入力のターゲットプライス(設定時は最優先) |
| target_price_at_purchase | DECIMAL(15,2) | NULL | 購入時点で算出したターゲットプライス(以後固定) |
| target_price_auto_logic | ENUM('eps_growth','pbr_normalization','analyst_consensus') | NULL | target_price_autoの算出ロジック |
| target_price_at_purchase_logic | ENUM('eps_growth','pbr_normalization','analyst_consensus') | NULL | target_price_at_purchaseの算出ロジック |
| highest_price_since_purchase | DECIMAL(15,2) | NULL | 保有期間中の最高値(トレイリングストップ用) |

**PK**: ticker_symbol。**FK**: `ticker_symbol → stocks(ticker_symbol)`。

> `purchase_price`・`quantity`(保有数)はこのテーブルには**保存しない**。複数回の買い増し・部分売却に対応するため、`trade_history`全体を都度集計して算出する(詳細は [`app/domain/trade_judgment.md`](../app/domain/trade_judgment.md))。

---

## 8. `trade_history` — 売買履歴

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| trade_id | BIGINT AUTO_INCREMENT | NOT NULL | — | **PK** |
| ticker_symbol | VARCHAR(10) | NOT NULL | — | FK → stocks |
| action | ENUM('buy','sell') | NOT NULL | — | 売買区分 |
| price | DECIMAL(15,2) | NOT NULL | — | 約定価格 |
| quantity | INT | NOT NULL | — | 株数 |
| traded_at | DATETIME | NOT NULL | — | 約定日時 |
| screening_group_id | INT | NULL | — | FK → screening_groups(判断根拠) |
| memo | TEXT | NULL | — | メモ |
| account_type | ENUM('taxable','nisa') | NOT NULL | 'taxable' | 口座種別 |

**PK**: trade_id。**FK**: `ticker_symbol → stocks`、`screening_group_id → screening_groups`。

---

## 9. `daily_stock_data` — 日次OHLCV

株価履歴のローカルキャッシュ(yfinance再取得の削減、チャート表示・テクニカル指標計算の元データ)。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK(複合)** part1、FK → stocks |
| date | DATE | NOT NULL | **PK(複合)** part2 |
| open_price | DECIMAL(15,2) | NULL | 始値 |
| close_price | DECIMAL(15,2) | NULL | 終値 |
| high_price | DECIMAL(15,2) | NULL | 高値 |
| low_price | DECIMAL(15,2) | NULL | 安値 |
| volume | BIGINT | NULL | 出来高 |

**PK**: (ticker_symbol, date)。**FK**: `ticker_symbol → stocks`。

---

## 10. `financial_results` — 決算期別財務データ

EDINET(金融庁の開示システム)の有価証券報告書から取得する、直近5期分の「経営指標等の推移」を格納する。`edinet_client.py`(`sync_filings`)が取込元。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK(複合)** part1、FK → stocks |
| fiscal_period | VARCHAR(20) | NOT NULL | **PK(複合)** part2、形式: "FY2026"(期末日の年)。有価証券報告書は年次のためQ表記は使わない |
| revenue | BIGINT | NULL | 売上高(百万円) |
| operating_profit | BIGINT | NULL | 営業利益(百万円)。**未使用**(経営指標等サマリーには5期分の推移が含まれないため、このパイプラインでは取得しない) |
| net_income | BIGINT | NULL | 当期純利益(百万円) |
| eps | DECIMAL(15,2) | NULL | 1株当たり当期純利益 |
| market_forecast_eps | DECIMAL(15,2) | NULL | 市場予想EPS。**未使用** |
| dividend_per_share | DECIMAL(10,2) | NULL | 1株当たり配当。**未使用** |
| equity_ratio | DECIMAL(5,2) | NULL | 自己資本比率(%) |
| roe | DECIMAL(5,2) | NULL | ROE(%) |
| operating_cf | BIGINT | NULL | 営業CF(百万円) |

**PK**: (ticker_symbol, fiscal_period)。**FK**: `ticker_symbol → stocks`。

> 現状のEDINET連携は直近5年分のみ(最新の有価証券報告書1件から取得できる範囲)。10年分への拡張は、5年前の書類を追加取得する発見手段が別途必要なため未対応。

---

## 10a. `edinet_filings` — EDINET取込済み書類の台帳

同じdoc_idの再取込を防ぎつつ、訂正有価証券報告書(元の書類と異なるdoc_idで提出される)を「未取込の新しいdoc_id」として検知するための台帳テーブル。`edinet-sync`(日次cron)・`edinet-backfill`(手動)の両方がこのテーブルを参照・更新する。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| doc_id | VARCHAR(16) | NOT NULL | **PK**、EDINET書類管理番号 |
| ticker_symbol | VARCHAR(10) | NOT NULL | FK → stocks |
| edinet_code | VARCHAR(10) | NOT NULL | EDINETコード |
| doc_type_code | VARCHAR(4) | NOT NULL | 120=有価証券報告書、130=訂正有価証券報告書 |
| period_end | DATE | NULL | 当期の期末日 |
| submitted_at | DATETIME | NULL | EDINETへの提出日時 |
| ingested_at | TIMESTAMP | NOT NULL | 自動設定(取込日時) |

**PK**: doc_id。**FK**: `ticker_symbol → stocks`。

---

## 11. `tags` — タグマスタ

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| tag_id | INT AUTO_INCREMENT | NOT NULL | **PK** |
| name | VARCHAR(50) | NOT NULL | タグ名(**UNIQUE**) |
| color | VARCHAR(7) | NULL | 表示色(#rrggbb) |

---

## 12. `stock_tags` — 銘柄×タグ(多対多)

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| ticker_symbol | VARCHAR(10) | NOT NULL | **PK(複合)** part1、FK → stocks |
| tag_id | INT | NOT NULL | **PK(複合)** part2、FK → tags |

---

## 13. `market_indicators` — 市場全体の日次指標

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| date | DATE | NOT NULL | **PK** |
| fx_usd_jpy | DECIMAL(10,4) | NULL | 米ドル/円レート |

FKなし。

---

## 14. `batch_logs` — バッチ実行ログ

リトライ制御(5分/30分/1時間、最大3回)の状態保持に使う。

| カラム | 型 | NULL | 既定値 | 説明 |
|---|---|---|---|---|
| log_id | BIGINT AUTO_INCREMENT | NOT NULL | — | **PK** |
| process_name | VARCHAR(100) | NULL | — | 処理名 |
| status | VARCHAR(20) | NULL | — | SUCCESS/FAILED/RUNNING/RETRYING(自由文字列、ENUMではない) |
| retry_count | INT | NOT NULL | 0 | 現在の再試行回数 |
| error_message | TEXT | NULL | — | エラー内容 |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | 初回登録日時 |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP (ON UPDATE) | 最終更新日時 |

FKなし。

---

## 15. `app_settings` — グローバル設定(キー・バリュー)

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| setting_key | VARCHAR(100) | NOT NULL | **PK** |
| setting_value | VARCHAR(255) | NOT NULL | 設定値(文字列、読み出し側でint/floatにキャスト) |

主なキー: `technical_score_candidate_threshold`、`capital_gains_tax_rate`、`trailing_stop_allowance_percent`、`technical_score_*`(テクニカルスコア計算式の各パラメータ、26キー)。FKなし。

---

## 16. `trading_fee_tiers` — 売買手数料テーブル

約定代金の金額帯別、片道手数料。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| tier_id | INT AUTO_INCREMENT | NOT NULL | **PK** |
| max_trade_value | DECIMAL(15,2) | NULL | この約定代金(円)以下に適用。NULLは上限なし(最上位ティア) |
| commission | DECIMAL(10,2) | NOT NULL | 片道手数料(円、税込) |

FKなし。

---

## エンティティ関係サマリ

- **ルートエンティティ**: `stocks`(PK: ticker_symbol)
- **stocksと1:1**(PK=ticker_symbolを共有): `user_stock_status`, `stock_metrics`, `technical_scores`
- **stocksと1:N**: `daily_stock_data`(複合PK+date), `financial_results`(複合PK+fiscal_period), `trade_history`, `stock_tags`(中間テーブル)
- **独立マスタ/設定テーブル**(FKなし): `market_indicators`, `batch_logs`, `app_settings`, `trading_fee_tiers`, `screening_param_definitions`, `tags`
- **ルール階層**: `screening_groups` (1) → (N) `screening_rules`(group_id経由)、`screening_groups` (1) → (N) `trade_history`(screening_group_id経由、どの戦略で売買したかの記録)

## 既知の欠落(マイグレーション履歴上の注意点)

`36_size_group_trade_judgment_rules.sql` 以降の複数ファイルは、`screening_groups`の`group_id = 6, 7, 8, 12`(小型株/中型株/大型株/デフォルト)を直接指定して`screening_rules`をINSERTしているが、**これら4グループ自体を作成する`INSERT INTO screening_groups`文はマイグレーションファイル群の中に存在しない**。実際にはアプリケーション経由(`POST /api/screening-groups`)で作成された前提になっている。ゼロから再構築する場合は、マイグレーション適用後に、アプリケーションの「グループ追加」機能で「小型株」「中型株」「大型株」を作成してから、対応するルール投入を行う必要がある(「デフォルト」グループは`35_default_trade_judgment_group.sql`で自己完結してINSERTされる)。
