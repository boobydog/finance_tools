# finance_tools 要求仕様書

このフォルダは、finance_tools(日本株投資支援システム)を**ゼロから再実装できる**ことを目的とした要求仕様書一式である。サーバー別(db / app / frontend)にフォルダを分け、各フォルダ内はさらに機能別にファイルを分割している。

なお、判定ロジックの計算方法・現状の設定値(参考値)については、リポジトリルートの [`README.md`](../README.md) に別途まとまった資料があるため、本フォルダの `app/domain/*.md` は業務要件(なぜそうするか)を中心に記載し、数式や現状パラメータの詳細はルートREADMEを参照する形にしている。

## 読む順序の目安

1. [`requirements/01_overview.md`](requirements/01_overview.md) — システムの目的・対象ユーザー・全体アーキテクチャ・技術スタック
2. [`requirements/02_glossary.md`](requirements/02_glossary.md) — 用語集(このドキュメント全体で前提になる語彙)
3. [`db/schema.md`](db/schema.md) と [`db/er_diagram.puml`](db/er_diagram.puml) — データモデル
4. [`app/architecture.md`](app/architecture.md) — バックエンドの設計原則
5. [`app/api_endpoints.md`](app/api_endpoints.md) と [`app/class_diagram.puml`](app/class_diagram.puml) — API仕様とモジュール構成
6. [`app/domain/`](app/domain/) — 業務ロジックの要件(候補スクリーニング・買入タイミング/損切り/利確判定・テクニカルスコア・取引コスト・ターゲットプライス)
7. [`app/batch_and_infra.md`](app/batch_and_infra.md) — CLI・cron・Docker構成
8. [`frontend/`](frontend/) — 画面・認証・コンポーネント・データ取得方針

## フォルダ構成

```
doc/
├── README.md                          (このファイル)
├── requirements/
│   ├── 01_overview.md                 システム概要・目的・技術スタック
│   └── 02_glossary.md                 用語集
├── db/
│   ├── schema.md                      全テーブル定義(16テーブル)
│   └── er_diagram.puml                ER図(PlantUML)
├── app/
│   ├── architecture.md                バックエンド設計原則
│   ├── api_endpoints.md               APIエンドポイント一覧(38本)
│   ├── class_diagram.puml             主要モジュールのクラス図(PlantUML)
│   ├── batch_and_infra.md             CLIコマンド・cronスケジュール・Docker構成
│   └── domain/
│       ├── candidate_screening.md     候補スクリーニング(自動候補化)の要件
│       ├── trade_judgment.md          買入タイミング・損切り・利確判定の要件
│       ├── technical_score.md         テクニカルスコアリングの要件
│       └── trading_costs_and_target_price.md  手数料・税金計算とターゲットプライスの要件
└── frontend/
    ├── pages_and_auth.md              画面一覧・認証仕様
    ├── components_and_data_layer.md   コンポーネント構成・データ取得方針
    └── tech_stack.md                  技術スタックの詳細
```

## 前提条件・注意事項

- 本仕様書は、2026年8月時点のリポジトリ実装から逆算(リバースエンジニアリング)して作成したものである。実装から仕様書を起こしているため、コードに現れている挙動を「要件」として記載している箇所がある。今後仕様を変更する場合は、まずこの仕様書を更新してから実装に反映することを推奨する。
- DBスキーマは `mysql/init/` 配下の47個の連番マイグレーションファイルを積み上げた最終状態を記載している。1つだけ既知の欠落があり、`db/schema.md` の該当箇所に明記している(小型株/中型株/大型株の3グループは、マイグレーションファイルにINSERT文が存在せず、アプリケーション経由で作成された前提になっている)。
- 金額・税率・手数料などの「現状の参考値」は変更される可能性が高いため、正確な最新値は稼働中のシステム(設定画面または `GET /api/screening-groups` 等のAPI)を参照すること。
