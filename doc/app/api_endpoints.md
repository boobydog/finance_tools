# APIエンドポイント一覧

FastAPIアプリケーション(`batch/api/main.py`)。全リクエスト/レスポンスは`CamelModel`(snake_case⇔camelCase自動変換)を経由し、フロントエンドの型定義と1対1対応させる。CORSは環境変数`CORS_ALLOW_ORIGINS`で許可オリジンを設定する。

合計41エンドポイント。

## 銘柄

| Method | Path | 説明 | Request | Response |
|---|---|---|---|---|
| GET | `/api/stocks` | 全銘柄一覧(ステータス/タグ/スコア/ターゲットプライス/直近終値付き)。呼び出しごとにバックグラウンドで指標再計算をトリガー | — | `list[Stock]` |
| GET | `/api/stocks/{ticker_symbol}` | 銘柄詳細 | — | `Stock`(404 if not found) |
| PUT | `/api/stocks/{ticker_symbol}/status` | ステータスを手動変更(候補/検討/保有中/売却済/除外) | `UpdateStockStatusRequest` | `Stock` |
| PUT | `/api/stocks/{ticker_symbol}/target-price` | 手動ターゲットプライスの設定/解除 | `UpdateTargetPriceRequest` | `Stock` |
| POST | `/api/stocks/{ticker_symbol}/trades` | 売買記録の登録。複数ロット買い増し・部分売却時のステータス遷移(holding/sold)・購入時スナップショットを管理 | `CreateTradeRequest` | `Stock` |
| POST | `/api/stocks/{ticker_symbol}/tags` | タグを手動で付与(既存タグはtagId、新規タグ名はtagNameで指定)。スクリーニンググループ名と同じタグを付けると、次回の判定エンジン評価からそのグループの基準が適用される。候補スクリーニングは既にステータスが設定された銘柄を再評価しないため、保有中銘柄に別グループの基準を後から適用したい場合に使う | `AttachStockTagRequest` | `Stock` |
| DELETE | `/api/stocks/{ticker_symbol}/tags/{tag_id}` | タグを手動で削除 | — | `Stock` |
| GET | `/api/stocks/{ticker_symbol}/price-history` | 日足/週足/月足の株価履歴 | query: `interval` | `list[PricePoint]` |
| GET | `/api/stocks/{ticker_symbol}/live-quote` | リアルタイム気配値(取引時間外はキャッシュ) | — | `LiveQuote`(502 on failure) |
| GET | `/api/live-quotes` | 画面表示中銘柄の一括気配値(最大50件) | query: `symbols`(CSV) | `list[LiveQuote]` |

## 判定シグナル

| Method | Path | 説明 | Response |
|---|---|---|---|
| GET | `/api/entry-signals` | 買入タイミング判定(候補/保有中/売却済が対象) | `list[EntrySignal]` |
| GET | `/api/loss-cut-signals` | 損切り判定(保有中が対象) | `list[LossCutSignal]` |
| GET | `/api/profit-taking-signals` | 利確判定(保有中が対象、手数料・税引後純損益込み) | `list[ProfitTakingSignal]` |

## その他の参照系

| Method | Path | 説明 | Response |
|---|---|---|---|
| GET | `/api/batch-logs` | バッチ実行ログ履歴 | `list[BatchLog]` |
| GET | `/api/market-indicators` | 市場指標(米ドル/円等)の日次推移 | `list[MarketIndicator]` |
| GET | `/api/tags` | 全タグ一覧 | `list[Tag]` |
| GET | `/api/news` | 銘柄関連ニュース(TDnet適時開示)。`?ticker_symbol=`で絞り込み、最新100件 | `list[NewsItem]` |

## 設定

| Method | Path | 説明 | Body/Response |
|---|---|---|---|
| GET/PUT | `/api/settings/technical-score-threshold` | 自動候補化のテクニカルスコアしきい値。PUTはバックグラウンドで再スコアリングをトリガー | `TechnicalScoreThreshold` |
| GET/PUT | `/api/settings/technical-score-config` | テクニカルスコア計算式(Stage2/RS/出来高/RSI/VCP/MACDの配点・期間・閾値)。PUTは全銘柄の再スコアリングをトリガー | `TechnicalScoreConfig` |
| GET/PUT | `/api/settings/capital-gains-tax-rate` | 譲渡益課税の税率(%) | `CapitalGainsTaxRate` |

## 取引手数料ティア

| Method | Path | 説明 | Body/Response |
|---|---|---|---|
| GET/POST | `/api/trading-fee-tiers` | 手数料ティア一覧取得/新規作成 | `UpsertTradingFeeTierRequest` → `list[TradingFeeTier]` |
| PUT/DELETE | `/api/trading-fee-tiers/{tier_id}` | 手数料ティア更新/削除 | → `list[TradingFeeTier]` |

## スクリーニンググループ・ルール

大半のミューテーション系エンドポイントは、DB更新後に共有JSONファイルへのエクスポート(`_sync_screening_rules_json`)とバックグラウンド再計算(`refresh_metrics_and_screening`)の両方をトリガーする。

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/screening-groups` | グループ一覧(ネストしたルール付き) |
| POST | `/api/screening-groups` | グループ新規作成 |
| PUT | `/api/screening-groups/{group_id}/active` | グループ全体の有効/無効切替 |
| PUT | `/api/screening-groups/{group_id}` | グループ更新(名称/説明/各種しきい値) |
| PUT | `/api/screening-groups/{group_id}/candidate-active` | 候補スクリーニング部分のみの有効/無効切替 |
| DELETE | `/api/screening-groups/{group_id}` | グループ削除(デフォルトグループは400エラーで拒否) |
| POST | `/api/screening-groups/{group_id}/rules` | ルール追加 |
| PUT | `/api/screening-rules/{rule_id}` | ルール更新 |
| DELETE | `/api/screening-rules/{rule_id}` | ルール削除 |
| GET | `/api/screening-param-definitions` | 全パラメータ定義一覧(ラベル/型/範囲) |
| GET | `/api/screening-rules/export` | DBのルールをA/B/C階層JSONとしてエクスポート(共有ファイルにも書き出し) |
| POST | `/api/screening-rules/import` | アップロードJSONから全グループ/ルールを一括置換 |

使用モデル: `ScreeningGroup`, `ScreeningRule`, `UpsertScreeningGroupRequest`, `UpdateScreeningGroupActiveRequest`, `UpdateScreeningGroupCandidateActiveRequest`, `CreateScreeningRuleRequest`, `ScreeningParamDefinition`, `ScreeningRulesExport`。

## 売買履歴

| Method | Path | 説明 | Response |
|---|---|---|---|
| GET | `/api/trade-history` | 全取引、または`?ticker_symbol=`で絞り込み | `list[TradeHistoryEntry]` |
| DELETE | `/api/trades/{trade_id}` | 取引記録の削除。残存数量を再集計してステータス(holding/sold/未設定)を整合 | `{"ok": true}` |

---

## Pydanticスキーマ(`batch/api/schemas.py`)

`CamelModel(BaseModel)`を共通基底に、`alias_generator=to_camel, populate_by_name=True`でsnake_case⇔camelCase変換を行う。

### 型エイリアス(Literal)

```python
StockStatus = Literal["interested", "holding", "sold", "excluded", "considering"]
TargetPriceLogic = Literal["eps_growth", "pbr_normalization", "analyst_consensus"]
EffectiveTargetPriceLogic = Literal["manual", *TargetPriceLogic]
AccountType = Literal["taxable", "nisa"]
PositionAccountType = Literal["taxable", "nisa", "mixed"]
ScreeningCategory = Literal["A", "B", "C"]
ScreeningOperator = Literal["gte", "lte", "eq"]
RulePurpose = Literal["candidate", "entry_timing", "loss_cut", "profit_taking"]
RuleValueMode = Literal["fixed", "hv_multiplier"]
```

### 主要モデル(フィールド概要)

- **`EntrySignal`**: ticker_symbol, name, sector, status, current_price, previous_close, ma25, ma25_above_streak_days, volume_ratio, earnings_surprise_percent, rsi, hv, screening_score, signal_count, signal_total, signal_count_threshold, is_strong_candidate, is_excluded, excluded_param_key, loss_cut_risk_at_entry, loss_cut_risk_param_key, ma25_deviation_percent, daily_change_percent, judgment_group_name
- **`LossCutSignal`**: ticker_symbol, name, sector, is_under_supervision, is_delisting_risk, purchase_score, current_score, current_price, purchase_price, operating_profit_yoy, eps_growth, hv, quantity, account_type, buy_commission, sell_commission, gross_gain, estimated_tax, net_profit, priority, judgment_group_name
- **`ProfitTakingSignal`**: ticker_symbol, name, sector, current_price, target_price_auto, target_price_manual, target_price_at_purchase, target_price_auto_logic, target_price_at_purchase_logic, purchase_price, quantity, account_type, highest_price_since_purchase, forward_per, hv, ma25, trailing_stop_trigger_price, effective_target_price, effective_target_price_logic, achievement_percent, buy_commission, sell_commission, gross_gain, estimated_tax, net_profit, should_take_profit, holding_days, holding_period_exit_days, is_holding_period_exceeded, judgment_group_name
- **`Stock`**: ticker_symbol, name, market_segment, sector, is_under_supervision, is_delisting_risk, status, tags, latest_close, change_percent, screening_score, purchase_score, target_price_auto, target_price_manual, target_price_at_purchase, target_price_auto_logic, target_price_at_purchase_logic
- **`TechnicalScoreConfig`**: stage2_points, stage2_sma_short_period, stage2_sma_long_period, stage2_trend_lookback_days, rs_points, rs_lookback_days, rs_threshold, volume_points, volume_average_period, volume_ratio_threshold, rsi_points, rsi_period, rsi_comfort_low, rsi_comfort_high, rsi_overbought_threshold, rsi_overbought_penalty, vcp_points, vcp_high52w_ratio_threshold, vcp_volatility_lookback_days, vcp_atr_period, vcp_history_lookback_days, macd_points, macd_fast_period, macd_slow_period, macd_signal_period, benchmark_symbol, history_period
- **`ScreeningGroup`**: group_id, name, description, is_active, is_default, candidate_screening_active, signal_count_threshold, holding_period_exit_days, trailing_stop_allowance_percent, rules
- **`ScreeningRule`**: rule_id, rule_purpose, category, param_key, operator, value_mode, param_value
- **`TradeHistoryEntry`** / **`CreateTradeRequest`**: action, price, quantity, traded_at, screening_group_id, memo, account_type

その他の細部(`LiveQuote`, `PricePoint`, `BatchLog`, `MarketIndicator`, `Tag`, `TradingFeeTier`, `CapitalGainsTaxRate`, `TechnicalScoreThreshold`, 各種Requestモデル)は上記モデル群と対応するテーブル定義([`../db/schema.md`](../db/schema.md))から自明に導出できる。
