# 用語集

本仕様書全体で前提となる語彙をまとめる。

## 銘柄ステータス(`user_stock_status.status`)

| 値 | 意味 |
|---|---|
| (NULL/未設定) | どの判断も下していない状態。候補スクリーニングの対象になりうる。 |
| `interested`(候補) | 投資対象として検討中。買入タイミング判定の対象。 |
| `holding`(保有中) | 実際に保有している。損切り判定・利確判定・買入タイミング判定(買い増し用)の対象。 |
| `sold`(売却済) | 過去に保有していたが全数量を売却済み。買入タイミング判定(再エントリー用)の対象。 |
| `excluded`(除外) | 投資対象外として明示的に除外。 |

## スクリーニンググループ

判定基準を束ねる単位。「小型株」「中型株」「大型株」「デフォルト」のように、投資戦略・銘柄セグメントごとに1つ作成する。1つのグループは、用途(`rule_purpose`)ごとに4種類のルールセットを持つ。

| rule_purpose | 用途 |
|---|---|
| `candidate` | 候補スクリーニング(自動候補化)用 |
| `entry_timing` | 買入タイミング判定用 |
| `loss_cut` | 損切り判定用 |
| `profit_taking` | 利確判定用 |

グループには以下の属性がある。

- `is_active`: グループ全体の有効/無効。
- `is_default`: 削除不可のフォールバックグループか。システム全体で常に1つ存在する。
- `candidate_screening_active`: 候補スクリーニング部分のみの有効/無効(`is_active`とは独立、主にデフォルトグループで使う)。
- `signal_count_threshold`: 買入タイミング判定で、いくつのシグナルを満たせば「有力候補」とするかの閾値。
- `holding_period_exit_days`: 保有期間の上限(日数)。超えたら損益に関わらず強制決済(利確判定の第3の判定軸)。
- `trailing_stop_allowance_percent`: トレイリングストップの許容下落率(%)。未設定の場合は全体設定にフォールバック。
- `auto_calc_logic_type`: ターゲットプライスの自動算出に使う優先ロジック。

## 分類A/B/C(`screening_rules.category`)

1件のルール(`screening_rules`の1行)は「分類(A/B/C)」を持つ。**同じ分類内の複数条件は常にOR(いずれか1つで成立)**。分類同士の組み合わせ方(該当時にどう扱うか)は用途(`rule_purpose`)ごとに異なり、汎用的なAND/OR指定機能ではない。用途別の具体的な組み合わせルールは [`app/domain/candidate_screening.md`](../app/domain/candidate_screening.md) と [`app/domain/trade_judgment.md`](../app/domain/trade_judgment.md) を参照。

## ルールの値の種別(`screening_rules.value_mode`)

| 値 | 意味 |
|---|---|
| `fixed`(固定値) | `min_threshold`/`max_threshold`をそのまま閾値として使う。 |
| `hv_multiplier`(HV倍率) | 値は倍率として扱い、実際の閾値 = 倍率 × その銘柄自身のHV(ヒストリカルボラティリティ)。値動きの荒い銘柄ほど閾値が自動的に広がる。 |

## タグ

銘柄に付与する自由なラベル(`tags`/`stock_tags`)。候補スクリーニングで候補化された際、根拠となったスクリーニンググループ名がタグとして自動付与される。このタグが、後続の買入タイミング/損切り/利確判定で「どのグループの基準を適用するか」を決めるキーになる(グループ解決、詳細は [`app/domain/trade_judgment.md`](../app/domain/trade_judgment.md)参照)。

## 派生値(derived value)

DBに直接保存されている値ではなく、判定エンジンが実行時にその場で計算する値(例: `drawdown_percent`購入価格からの下落率、`score_diff`購入時からのスコア変化、`achievement_percent`ターゲットプライス達成度、`is_below_ma25`MA25割れ など)。`screening_param_definitions`テーブルには、保存値と派生値の両方が同じ形式で登録されており、ルール設定画面ではどちらも同様に選択できる。

## テクニカルスコア(`screening_score`)

Weinstein ステージ2判定・相対強度(RS)・出来高急増・RSI適温ゾーン・VCP/52週高値圏・MACD上昇モメンタムの6要素の加点(一部減点)合計。候補スクリーニングの自動候補化しきい値、および買入タイミング判定の一部条件で使用する。計算式の詳細は [`app/domain/technical_score.md`](../app/domain/technical_score.md) を参照。

## 純損益ゲート

利確判定において、額面上の利確条件(目標株価到達など)を満たしていても、手数料・税金を差し引いた実質損益がプラスでなければ利確シグナルとして扱わない仕組み。詳細は [`app/domain/trading_costs_and_target_price.md`](../app/domain/trading_costs_and_target_price.md)。

## 口座種別(`account_type`)

| 値 | 意味 |
|---|---|
| `taxable`(特定/一般) | 特定口座(源泉徴収あり)/一般口座。譲渡益に課税、売買手数料がかかる。 |
| `nisa`(NISA) | NISA口座。譲渡益非課税・手数料無料として扱う。 |
| `mixed`(混在、表示専用) | 同一銘柄について、taxableとnisa両方に残存ポジションがある状態。個別の取引記録には設定できない、集計結果としてのみ現れる値。 |
