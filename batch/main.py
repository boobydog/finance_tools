"""CLIエントリポイント。

コマンドライン引数を解析し、stock_fetcher(銘柄コード指定でのデータ取得)、
stock_screener(JSON条件での銘柄スクリーニング)、
csv_exporter(CSV出力・保管期限切れ削除)を組み合わせて実行する。
"""

import argparse
import logging
import os
from datetime import datetime, timedelta

from sqlalchemy import text

from scripts import batch_logger
from scripts.csv_exporter import CSV_RETENTION_DAYS, cleanup_old_csv, export_csv
from scripts.db import get_engine
from scripts.edinet_client import sync_filings
from scripts.jpx_importer import import_stocks
from scripts.legacy_screen_config import import_legacy_screen_config
from scripts.metrics_fetcher import run_fundamentals_fetch, run_metrics_fetch
from scripts.nikkei225 import fetch_constituent_symbols
from scripts.screening_config import export_screening_rules_json
from scripts.screening_engine import evaluate_and_apply
from scripts.sql_runner import load_sql
from scripts.stock_fetcher import fetch_history, fetch_info, fetch_realtime
from scripts.stock_screener import fetch_jp_all_stocks, fetch_screened, load_screen_config
from scripts.target_price import sync_target_prices
from scripts.tdnet_client import sync_news
from scripts.target_symbols import get_tracked_ticker_symbols, resolve_target_symbols
from scripts.technical_screener import (
    DEFAULT_CANDIDATE_SCORE_THRESHOLD,
    apply_score_candidates,
    persist_scores,
    run_technical_screen,
    sync_score_tags,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

JPX_IMPORT_PROCESS_NAME = "jpx_import"
JPX_IMPORT_MIN_RUN_INTERVAL = timedelta(hours=24)

FETCH_FUNDAMENTALS_PROCESS_NAME = "fetch_fundamentals"
FETCH_FUNDAMENTALS_MIN_RUN_INTERVAL = timedelta(hours=24)

FETCH_EARNINGS_DAY_FUNDAMENTALS_PROCESS_NAME = "fetch_earnings_day_fundamentals"
FETCH_EARNINGS_DAY_FUNDAMENTALS_MIN_RUN_INTERVAL = timedelta(hours=6)

EDINET_SYNC_PROCESS_NAME = "edinet_sync"
EDINET_SYNC_MIN_RUN_INTERVAL = timedelta(hours=20)
# 週末・祝日や前回実行の取りこぼしに備え、直近数日分を毎回スキャンし直す
# (取込済みのdoc_idはedinet_filings台帳でスキップされるため、再スキャンのコストは軽い)。
EDINET_SYNC_LOOKBACK_DAYS = 5
# 3月決算企業が大半を占め、有価証券報告書は期末から3ヶ月以内に提出されるため、
# 直近15ヶ月分をスキャンすればほぼ全ての追跡銘柄の最新書類を発見できる。
EDINET_BACKFILL_DEFAULT_LOOKBACK_DAYS = 450

MARKET_NEWS_SYNC_PROCESS_NAME = "market_news_sync"
MARKET_NEWS_SYNC_MIN_RUN_INTERVAL = timedelta(hours=2)
# 適時開示は当日中に複数件出ることもあるため、他バッチより短い間隔で巡回する。
# 直近数日分を毎回取り直すが、news_idで冪等に取込むため再取得のコストは軽い。
MARKET_NEWS_SYNC_LOOKBACK_DAYS = 3

SCREENING_RULES_JSON_PATH = os.environ.get(
    "SCREENING_RULES_JSON_PATH", "./data/screening/screening_rules.json"
)


def parse_args(argv=None):
    """コマンドライン引数を解析し、Namespaceを返す。"""
    parser = argparse.ArgumentParser(description="yfinance を使った株価取得ツール")
    sub = parser.add_subparsers(dest="command", required=True)

    realtime_parser = sub.add_parser("realtime", help="指定銘柄のリアルタイム情報を取得しCSVで出力")
    realtime_parser.add_argument("symbols", nargs="+", help="銘柄コード (例: 7203.T AAPL)")

    info_parser = sub.add_parser("info", help="指定銘柄の基本情報を取得しCSVで出力")
    info_parser.add_argument("symbols", nargs="+", help="銘柄コード (例: 7203.T AAPL)")

    history_parser = sub.add_parser("history", help="指定銘柄の過去情報を取得しCSVで出力")
    history_parser.add_argument("symbols", nargs="+", help="銘柄コード (例: 7203.T AAPL)")
    history_parser.add_argument("--period", default="1mo", help="取得期間 (例: 1d, 5d, 1mo, 1y, max)")
    history_parser.add_argument("--interval", default="1d", help="取得間隔 (例: 1m, 5m, 1d, 1wk)")

    screen_parser = sub.add_parser("screen", help="JSONファイルの検索条件で銘柄をスクリーニングしCSVで出力")
    screen_parser.add_argument("config", help="検索条件を記述したJSONファイルのパス")

    sub.add_parser("jp-all", help="日本国内に存在するすべての株式銘柄のコードと名前を取得しCSVで出力")

    sub.add_parser("jpx-import", help="JPX公式サイトから銘柄一覧・監理/整理銘柄情報を取得しDBへ反映")

    technical_screen_parser = sub.add_parser(
        "technical-screen", help="JSONファイルの候補銘柄をテクニカル指標でスコアリングしCSVで出力"
    )
    technical_screen_parser.add_argument("config", help="候補銘柄・スコアリング条件を記述したJSONファイルのパス")
    technical_screen_parser.add_argument(
        "--candidate-threshold",
        type=int,
        default=DEFAULT_CANDIDATE_SCORE_THRESHOLD,
        help="このスコア以上、かつステータス未設定の銘柄を自動で「候補」にする閾値",
    )

    sub.add_parser(
        "sync-screening-rules",
        help="DBのscreening_groups/screening_rulesを共有JSON(screening_rules.json)へ書き出す",
    )

    metrics_parser = sub.add_parser(
        "fetch-metrics", help="yfinanceから基礎指標・技術指標を取得しstock_metricsへ保存(手動実行用)"
    )
    metrics_parser.add_argument("config", help='候補銘柄を記述したJSONファイルのパス({"symbols": [...], "include_nikkei225": true})')

    sub.add_parser(
        "fetch-fundamentals",
        help="対象銘柄(候補/保有/除外+日経225)の基礎指標(PER/PBR/ROE等)を取得(1日1回想定・cron用)",
    )

    sub.add_parser(
        "fetch-earnings-day-fundamentals",
        help="決算発表日・その翌日にあたる銘柄の基礎指標を個別に取得(数時間おき想定・cron用)",
    )

    sub.add_parser(
        "run-screening-engine",
        help="screening_groups/rulesを未設定の銘柄に適用し、候補(interested)へ反映",
    )

    legacy_parser = sub.add_parser(
        "import-legacy-screen-config",
        help="旧stock_screener.py用のJSON(sector/時価総額等)を新screening_groups形式へ変換して取り込む",
    )
    legacy_parser.add_argument("config", help="旧形式の検索条件JSONファイルのパス")
    legacy_parser.add_argument("--name", required=True, help="作成するスクリーニンググループ名")

    cleanup_parser = sub.add_parser("cleanup", help="保管期間(既定30日)を過ぎたCSVを削除")
    cleanup_parser.add_argument("--days", type=int, default=CSV_RETENTION_DAYS, help="保管日数")

    backfill_parser = sub.add_parser(
        "edinet-backfill",
        help="EDINETから対象銘柄の有価証券報告書(経営指標等5期分)を一括取得(手動実行用)",
    )
    backfill_parser.add_argument(
        "--lookback-days",
        type=int,
        default=EDINET_BACKFILL_DEFAULT_LOOKBACK_DAYS,
        help=f"何日前まで書類一覧を遡って走査するか(既定{EDINET_BACKFILL_DEFAULT_LOOKBACK_DAYS}日)",
    )

    sub.add_parser(
        "edinet-sync",
        help="EDINETの直近数日分の書類一覧を走査し、新規・訂正の有価証券報告書を取り込む(cron用)",
    )

    sub.add_parser(
        "sync-market-news",
        help="TDnetの適時開示情報から対象銘柄のニュースを取得(cron用)",
    )

    return parser.parse_args(argv)


def run_jpx_import() -> None:
    """JPX銘柄一覧・監理/整理銘柄情報の取得〜DB反映を、リトライ状況を見ながら実行する。"""
    engine = get_engine()
    retry_count = batch_logger.get_next_attempt(
        engine, JPX_IMPORT_PROCESS_NAME, JPX_IMPORT_MIN_RUN_INTERVAL
    )
    if retry_count is None:
        return

    log_id = batch_logger.start(engine, JPX_IMPORT_PROCESS_NAME, retry_count)
    try:
        result = import_stocks(engine)
    except Exception as exc:
        logger.exception("jpx_import failed (retry_count=%d)", retry_count)
        batch_logger.finish_failure(engine, log_id, str(exc))
        return

    batch_logger.finish_success(engine, log_id)
    logger.info("jpx_import completed: %s", result)


def run_fundamentals_fetch_batch() -> None:
    """対象銘柄(候補/保有/除外+日経225)の基礎指標を、リトライ状況を見ながら1日1回取得する。"""
    engine = get_engine()
    retry_count = batch_logger.get_next_attempt(
        engine, FETCH_FUNDAMENTALS_PROCESS_NAME, FETCH_FUNDAMENTALS_MIN_RUN_INTERVAL
    )
    if retry_count is None:
        return

    log_id = batch_logger.start(engine, FETCH_FUNDAMENTALS_PROCESS_NAME, retry_count)
    try:
        symbols = resolve_target_symbols(engine)
        saved = run_fundamentals_fetch(engine, symbols)
        sync_target_prices(engine, get_tracked_ticker_symbols(engine))
    except Exception as exc:
        logger.exception("fetch_fundamentals failed (retry_count=%d)", retry_count)
        batch_logger.finish_failure(engine, log_id, str(exc))
        return

    batch_logger.finish_success(engine, log_id)
    logger.info("fetch-fundamentals completed: %d/%d symbols saved", saved, len(symbols))


def run_earnings_day_fundamentals_fetch_batch() -> None:
    """決算発表日・その翌日にあたる銘柄の基礎指標を、リトライ状況を見ながら個別に更新する。"""
    engine = get_engine()
    retry_count = batch_logger.get_next_attempt(
        engine, FETCH_EARNINGS_DAY_FUNDAMENTALS_PROCESS_NAME, FETCH_EARNINGS_DAY_FUNDAMENTALS_MIN_RUN_INTERVAL
    )
    if retry_count is None:
        return

    log_id = batch_logger.start(engine, FETCH_EARNINGS_DAY_FUNDAMENTALS_PROCESS_NAME, retry_count)
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(load_sql("select_earnings_day_ticker_symbols.sql"))).mappings().all()
        symbols = [row["ticker_symbol"] for row in rows]
        saved = run_fundamentals_fetch(engine, symbols) if symbols else 0
    except Exception as exc:
        logger.exception("fetch_earnings_day_fundamentals failed (retry_count=%d)", retry_count)
        batch_logger.finish_failure(engine, log_id, str(exc))
        return

    batch_logger.finish_success(engine, log_id)
    logger.info("fetch-earnings-day-fundamentals completed: %d symbols saved", saved)


def run_edinet_sync_batch() -> None:
    """EDINETの直近数日分を、リトライ状況を見ながら日次で巡回する(新規・訂正の取込)。"""
    engine = get_engine()
    retry_count = batch_logger.get_next_attempt(engine, EDINET_SYNC_PROCESS_NAME, EDINET_SYNC_MIN_RUN_INTERVAL)
    if retry_count is None:
        return

    log_id = batch_logger.start(engine, EDINET_SYNC_PROCESS_NAME, retry_count)
    try:
        symbols = resolve_target_symbols(engine)
        result = sync_filings(engine, symbols, EDINET_SYNC_LOOKBACK_DAYS)
    except Exception as exc:
        logger.exception("edinet_sync failed (retry_count=%d)", retry_count)
        batch_logger.finish_failure(engine, log_id, str(exc))
        return

    batch_logger.finish_success(engine, log_id)
    logger.info("edinet-sync completed: %s", result)


def run_market_news_sync_batch() -> None:
    """TDnetの直近数日分を、リトライ状況を見ながら巡回する(適時開示ニュースの取込)。"""
    engine = get_engine()
    retry_count = batch_logger.get_next_attempt(
        engine, MARKET_NEWS_SYNC_PROCESS_NAME, MARKET_NEWS_SYNC_MIN_RUN_INTERVAL
    )
    if retry_count is None:
        return

    log_id = batch_logger.start(engine, MARKET_NEWS_SYNC_PROCESS_NAME, retry_count)
    try:
        symbols = resolve_target_symbols(engine)
        result = sync_news(engine, symbols, MARKET_NEWS_SYNC_LOOKBACK_DAYS)
    except Exception as exc:
        logger.exception("market_news_sync failed (retry_count=%d)", retry_count)
        batch_logger.finish_failure(engine, log_id, str(exc))
        return

    batch_logger.finish_success(engine, log_id)
    logger.info("sync-market-news completed: %s", result)


def main(argv=None) -> None:
    """指定されたコマンド(realtime/history/screen/cleanup)を実行する。"""
    args = parse_args(argv)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if args.command == "realtime":
        records = fetch_realtime(args.symbols)
        export_csv(records, f"realtime_{timestamp}.csv")
        cleanup_old_csv()
    elif args.command == "info":
        records = fetch_info(args.symbols)
        export_csv(records, f"info_{timestamp}.csv")
        cleanup_old_csv()
    elif args.command == "history":
        records = fetch_history(args.symbols, args.period, args.interval)
        export_csv(records, f"history_{args.period}_{args.interval}_{timestamp}.csv")
        cleanup_old_csv()
    elif args.command == "screen":
        records = fetch_screened(args.config)
        export_csv(records, f"screen_{timestamp}.csv")
        cleanup_old_csv()
    elif args.command == "jp-all":
        records = fetch_jp_all_stocks()
        export_csv(records, f"jp_all_{timestamp}.csv")
        cleanup_old_csv()
    elif args.command == "jpx-import":
        run_jpx_import()
    elif args.command == "technical-screen":
        records = run_technical_screen(get_engine(), load_screen_config(args.config))
        export_csv(records, f"technical_screen_{timestamp}.csv")
        cleanup_old_csv()
        engine = get_engine()
        persist_scores(engine, records)
        sync_score_tags(engine, records)
        applied = apply_score_candidates(engine, args.candidate_threshold)
        logger.info("technical-screen applied candidate status to %d stocks", applied)
    elif args.command == "sync-screening-rules":
        export_screening_rules_json(get_engine(), SCREENING_RULES_JSON_PATH)
    elif args.command == "fetch-metrics":
        config = load_screen_config(args.config)
        symbols = set(config.get("symbols", []))
        if config.get("include_nikkei225"):
            symbols |= set(fetch_constituent_symbols())
        saved = run_metrics_fetch(get_engine(), sorted(symbols))
        logger.info("fetch-metrics completed: %d symbols saved", saved)
    elif args.command == "fetch-fundamentals":
        run_fundamentals_fetch_batch()
    elif args.command == "fetch-earnings-day-fundamentals":
        run_earnings_day_fundamentals_fetch_batch()
    elif args.command == "run-screening-engine":
        result = evaluate_and_apply(get_engine())
        logger.info("run-screening-engine completed: %s", result)
    elif args.command == "import-legacy-screen-config":
        result = import_legacy_screen_config(get_engine(), args.config, args.name)
        logger.info("import-legacy-screen-config completed: %s", result)
    elif args.command == "cleanup":
        cleanup_old_csv(args.days)
    elif args.command == "edinet-backfill":
        symbols = resolve_target_symbols(get_engine())
        result = sync_filings(get_engine(), symbols, args.lookback_days)
        logger.info("edinet-backfill completed: %s", result)
    elif args.command == "edinet-sync":
        run_edinet_sync_batch()
    elif args.command == "sync-market-news":
        run_market_news_sync_batch()


if __name__ == "__main__":
    main()
