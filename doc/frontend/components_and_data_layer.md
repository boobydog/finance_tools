# コンポーネント構成・データ取得方針

## データ取得アーキテクチャ

- **バックエンド呼び出しの一元化**: `frontend/src/lib/api.ts`が唯一のHTTPクライアント層。共通の`apiFetch<T>(path, init)`ラッパー(`NEXT_PUBLIC_API_BASE_URL`を基点、JSON Content-Type、非OKレスポンスは例外を投げる)を経由し、約30個の型付き関数を公開する。
- **状態管理**: TanStack Query(React Query) v5。`frontend/src/hooks/`配下に画面横断で使うクエリ/ミューテーションフックをまとめる(`useStocks.ts`, `useScreening.ts`, `useDashboard.ts`, `useLiveQuote.ts`, `usePriceHistory.ts`)。グローバルなクライアント状態管理ライブラリ(Redux等)は使わない。
- **型定義の一元化**: `frontend/src/types/index.ts`が唯一の共有TypeScript型定義source。バックエンドのDBスキーマ・Pydanticスキーマと1対1対応するように保つ(camelCase、バックエンドの`CamelModel`のエイリアス変換と対応)。
- **キャッシュ方針**: 既定`staleTime: 30秒`、`refetchOnWindowFocus: false`。ライブ気配値のように鮮度が重要なデータは、個別のフックで`refetchInterval`を明示的に設定する(市場が開いている間は短め、閉じている間は長め)。

## リアルタイム性への配慮

- `useLiveQuote`/`useLiveQuotes`は、東証の取引時間(`lib/marketHours.ts`の`isTseOpen()`)に応じてポーリング間隔を変える設計とすること(取引時間中は60〜120秒、時間外はより長い間隔、例: 10分)。バックエンドの外部データソース(yfinance)が非公式・レート制限ありのAPIであることを踏まえた設計。
- バックグラウンドタブでのポーリングは停止すること(`refetchIntervalInBackground: false`)。

## 主要な共通コンポーネント

| コンポーネント | 役割 |
|---|---|
| `common/AppShell.tsx` | 全画面共通レイアウト(AppBar+ナビゲーションドロワー) |
| `common/MarketStatusChip.tsx` | 東証の取引時間中/時間外を示すチップ(60秒ごとに再評価) |
| `charts/StockPriceChart.tsx` | ローソク足+出来高+移動平均線のチャート。カスタム描画のローソク足形状、MA表示切替の状態はセッションストレージに保持 |
| `dashboard/BatchLogTable.tsx` | バッチ実行ログのテーブル表示 |
| `dashboard/NewsList.tsx` | ニュース一覧表示 |
| `stocks/StatusActions.tsx` | ステータス変更ボタン群(候補/検討/購入/売却/除外) |
| `stocks/StockTagsPanel.tsx` | タグの手動付与/削除(銘柄詳細画面)。スクリーニンググループ名と同じタグを付けると、既にステータスが設定済み(保有中等)で候補スクリーニングの対象外になった銘柄にも、後から特定グループの判定基準を適用できる |
| `stocks/StatusChip.tsx` | ステータス表示バッジ |
| `stocks/TradeDialog.tsx` | 売買記録入力ダイアログ(価格・数量・口座種別・根拠グループ・メモ) |
| `stocks/TradeHistoryPanel.tsx` | 売買履歴一覧(削除ボタン付き) |
| `stocks/ExitJudgmentDetail.tsx` | 損切り・利確判定の詳細内訳(一覧画面のダイアログ、詳細画面のインライン表示の両方で再利用) |
| `stocks/StockTable.tsx` / `stocks/StockCard.tsx` | 銘柄一覧のデスクトップ/モバイル表示切替 |
| `stocks/StickyActionBar.tsx` | モバイル用の画面下部固定アクションバー |
| `screening/RuleEditor.tsx` | スクリーニンググループ・ルールのCRUD編集UI |

## コンポーネント設計の指針

- **画面間で判定ロジックを重複させない**: 判定そのもの(有力候補か・損切り優先度・利確要否)はすべてバックエンド(判定エンジン)が計算済みの値を返す。フロントエンドは表示用の集約・整形のみを行う(`lib/tradeSignals.ts`の`classifyTrade`が好例: 複数の判定結果オブジェクトを1つの優先順位付きバッジにまとめるだけで、しきい値判定などのロジック自体は持たない)。
- **一覧⇄詳細で表示コンポーネントを共有する**: 例えば損切り・利確の詳細情報は、一覧画面のダイアログと、銘柄詳細画面のインライン表示の両方で、同一コンポーネント(`ExitJudgmentDetail`)を再利用すること。
- **モバイル対応**: 一覧系画面はデスクトップ(テーブル/DataGrid)とモバイル(カードリスト+下部固定アクションバー)を`useMediaQuery`で切り替える設計とする。
