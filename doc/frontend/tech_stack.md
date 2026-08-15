# フロントエンド技術スタック

| 分類 | 技術 | バージョン目安 | 備考 |
|---|---|---|---|
| フレームワーク | Next.js | 16.x | App Router。Turbopackはオプトイン(既定は通常のdevサーバー、`--turbo`フラグで切替) |
| UIライブラリ | React | 19.x | |
| コンポーネントライブラリ | MUI | v9(`@mui/material`, `@mui/icons-material`) | |
| データグリッド | `@mui/x-data-grid` | v9 | 買入タイミング判定・損切り利確判定画面等の一覧表示に使用(Community版、行の展開機能などPro限定機能は使わない設計にすること) |
| データ取得/キャッシュ | TanStack Query | v5(`@tanstack/react-query` + devtools) | |
| チャート | Recharts | v3 | ローソク足はRecharts標準機能ではなくカスタム描画(`ComposedChart`+カスタム`Bar`シェイプ)で実装する |
| 認証 | NextAuth | v4 | Credentials Provider、JWTセッション |
| スタイリング基盤 | Emotion | v11(MUIの内部スタイリングエンジン) | |
| パッケージマネージャ | pnpm | v10 | |
| 言語 | TypeScript | v5 | |
| Lint | ESLint | v9 | |
| E2Eテスト | Playwright | v1 | devDependency |

## Next.js 16特有の注意点

学習データにあるNext.jsの一般的な知識と異なる破壊的変更が含まれるバージョンであるため、実装前に該当バージョンの公式ドキュメントを確認すること。特に以下は本プロジェクトで実際に踏襲されている変更点。

- **`middleware.ts` → `proxy.ts`への名称変更**: 挙動は同じだが、ファイル名・エクスポート規約が変わっている。認証ガードはこの新しい規約(`src/proxy.ts`)で実装すること。
- **Turbopackはオプトイン**: `next dev`(既定、Webpack)と`next dev --turbo`(Turbopack)を別スクリプトとして用意し、既定のdevコマンドはTurbopackを使わない。
- **型付きルートpropsパターン**: レイアウト・ページコンポーネントの型定義に、Next.js側が自動生成するルートパラメータ型(例: `LayoutProps<"/">`)を使う新しい慣習がある。

## 環境変数

| 変数名 | 用途 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | バックエンドAPIのベースURL(既定: `http://localhost:8000`) |
| `ENABLE_AUTH` | 認証機能のON/OFF |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth設定 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 単一管理者アカウントの認証情報 |

## テーマ設定の要件

- 既定はダークモード(ライトモードにも対応するテーマ定義を用意すること)。
- プライマリカラー・成功色(騰落率プラス)・エラー色(騰落率マイナス)を明確に区別できる配色にすること(株価の上昇/下落表示に頻用するため)。
- 日本語フォントが崩れないフォントスタックを指定すること。
