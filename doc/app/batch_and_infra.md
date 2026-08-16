# CLIコマンド・cronスケジュール・インフラ構成

## CLIエントリポイント(`batch/main.py`)

argparseサブコマンド形式。`docker compose exec app python main.py <subcommand> ...`で手動実行できること。

| サブコマンド | 引数 | 説明 | 想定される呼び出し元 |
|---|---|---|---|
| `realtime` | `symbols...` | リアルタイム気配値取得 → CSV出力 | 手動 |
| `info` | `symbols...` | 企業基本情報取得 → CSV出力 | 手動 |
| `history` | `symbols... --period --interval` | 株価履歴取得 → CSV出力 | 手動 |
| `screen` | `config`(JSONパス) | yfinance条件スクリーニング → CSV出力 | 手動 |
| `jp-all` | — | 日本国内全上場銘柄取得 → CSV出力 | 手動 |
| `jpx-import` | — | JPX公式サイトから銘柄一覧・監理/上場廃止リスクフラグを`stocks`テーブルへ反映。`batch_logger`によるリトライ制御あり | **cron: 5分おき(実処理は24時間に1回に自己抑制)** |
| `technical-screen` | `config`(JSON), `--candidate-threshold` | JSON指定銘柄群のテクニカルスコアリング → CSV出力、スコア/タグ永続化、候補ステータス反映 | 手動 |
| `sync-screening-rules` | — | DBのスクリーニングルールを共有JSONファイルへエクスポート | 手動/オンデマンド |
| `fetch-metrics` | `config`(JSON: symbols + include_nikkei225) | ファンダメンタルズ+テクニカル指標の一括取得(1回限り) | 手動 |
| `fetch-fundamentals` | — | 追跡対象銘柄+日経225銘柄のファンダメンタルズを日次更新、ターゲットプライス再計算も実行。リトライ制御あり | **cron: 1時間おき(実処理は24時間に1回に自己抑制)** |
| `fetch-earnings-day-fundamentals` | — | 決算発表が今日/明日の銘柄のみファンダメンタルズ再取得。リトライ制御あり | **cron: 6時間おき** |
| `run-screening-engine` | — | `screening_groups`/`rules`を未設定銘柄に適用 | 手動 |
| `import-legacy-screen-config` | `config`(JSON), `--name`(必須) | 旧形式スクリーニングJSONを新グループとして移行 | 手動、一度限りの移行作業 |
| `cleanup` | `--days`(既定30) | N日より古いCSV出力を削除 | 手動 |
| `edinet-backfill` | `--lookback-days`(既定450) | EDINETの書類一覧を指定日数分遡って走査し、追跡対象銘柄の有価証券報告書(経営指標等5期分)を一括取得。初回セットアップ用 | 手動、一度限りの初回バックフィル |
| `edinet-sync` | — | EDINETの直近5日分を走査し、新規・訂正の有価証券報告書を取り込む。リトライ制御あり | **cron: 1時間おき(実処理は20時間に1回に自己抑制)** |
| `sync-market-news` | — | TDnet(適時開示情報)から追跡対象銘柄の直近3日分のニュースを取得。リトライ制御あり | **cron: 30分おき(実処理は2時間に1回に自己抑制)** |

## cron設定

`batch/crontab`(コンテナ内`/etc/cron.d/batch-cron`に配置、`entrypoint.sh`から`cron -f`で起動)。

```cron
*/5 * * * * root cd /app && python main.py jpx-import >> /app/logs/jpx_import.log 2>&1
0 * * * *    root cd /app && python main.py fetch-fundamentals >> /app/logs/fetch_fundamentals.log 2>&1
0 */6 * * * root cd /app && python main.py fetch-earnings-day-fundamentals >> /app/logs/fetch_earnings_day_fundamentals.log 2>&1
0 * * * *    root cd /app && python main.py edinet-sync >> /app/logs/edinet_sync.log 2>&1
*/30 * * * * root cd /app && python main.py sync-market-news >> /app/logs/market_news_sync.log 2>&1
```

**設計上のポイント**: cronのポーリング間隔(5分・1時間・6時間)と、実際の処理実行間隔は別物である。`scripts/batch_logger.py`が`batch_logs`テーブルの実行履歴を見て、指定の最小実行間隔(例: 24時間)に満たなければ何もせず終了する。これにより「cronは頻繁にポーリングしつつ、実処理は適切な頻度に抑える」という設計を実現している。失敗時は5分→30分→1時間の間隔で最大3回リトライする。

`entrypoint.sh`は、コンテナ起動時の環境変数を`/etc/environment`に書き出してから`cron -f`をforeground実行する(cronジョブはデフォルトでは起動時の環境変数を引き継がないため、この一手間が必要)。

## Docker Compose構成

4サービス + 1ボリューム + 2シークレット。

| サービス | ビルド元 | 役割 | ポート | 備考 |
|---|---|---|---|---|
| `frontend` | `./frontend` | Next.jsフロントエンド | 3000:3000 | ソースをbind mountして開発時ホットリロード |
| `api` | `./batch`(同一イメージ) | REST APIサーバー | 8000:8000 | `command`を`uvicorn api.main:app --reload`に上書き |
| `app` | `./batch`(同一イメージ) | cronバッチ実行 | — | 既定CMD(`/entrypoint.sh`)のまま。`tty:true`で対話的なCLI手動実行にも使う |
| `db` | `mysql:8.4` | MySQLデータベース | 3306:3306 | `mysql/init/`をDocker標準の`docker-entrypoint-initdb.d`としてマウント(新規ボリューム作成時のみ自動実行) |

`api`と`app`は**全く同じDockerイメージ**を使い、`command`の上書きだけで役割を切り替える設計。新機能追加時にコードを2箇所に重複させないため。

**環境変数(主要なもの)**:
- DB接続: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`または`DB_PASSWORD_FILE`(Docker secret経由)
- API: `CORS_ALLOW_ORIGINS`, `SCREENING_RULES_JSON_PATH`
- `app`のみ: `EDINET_API_KEY`(EDINET APIキー、`.env`から読み込み。`edinet-backfill`/`edinet-sync`で使用)
- フロントエンド: `NEXT_PUBLIC_API_BASE_URL`, `ENABLE_AUTH`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

**シークレット**: `mysql_root_password`, `mysql_password` — ファイルベース(`mysql/secrets/*.txt`)で管理し、環境変数に直書きしない。

## `batch/Dockerfile`

`python:3.12-slim`ベース。`cron`パッケージをapt-getでインストールし、`requirements.txt`(yfinance, xlrd, lxml, SQLAlchemy, pymysql, TA-Lib, fastapi, uvicorn)をpipインストール。`main.py`, `scripts/`, `sql/`, `api/`をコピーし、crontabを`/etc/cron.d/batch-cron`にインストール、既定CMDは`entrypoint.sh`。
