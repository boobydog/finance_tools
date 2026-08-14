"""stock_metricsの鮮度維持とscreening_engineの再評価をまとめて行う共通パイプライン。

銘柄管理画面を開いた時・スクリーニング設定の保存時に、APIから非同期(バックグラウンド)
で呼び出される。全銘柄を毎回yfinanceから取得するのは現実的でないため、対象銘柄は
次の2つの合算に限定する(scripts.target_symbols):
- ユーザーが既に判断を下した銘柄(候補/保有/除外) : 表示中のスコア・指標を最新化する
- 日経225構成銘柄 : まだステータス未設定の銘柄にも指標を持たせ、screening_engineが
  新規候補を発見できるようにする

同じ対象銘柄に対してテクニカルスコアリング(Weinstein/RS/出来高/RSI/VCP、
technical_screener.py)も実行し、「スコア」列・高スコア候補反映を最新化する。

基礎指標(PER/PBR/ROE等)は決算でしか変わらず、balance_sheet/income_stmt等の追加
API呼び出しで時間がかかるため、ここでは取得しない。cronの日次バッチ
(fetch-fundamentals/fetch-earnings-day-fundamentals)が別途更新する。

保有/候補銘柄のターゲットプライス(target_price_auto)もあわせて再計算する
(scripts.target_price)。現在値の更新頻度がここでの再計算のトリガーになる。

保有銘柄のトレイリングストップ用「保有期間中の最高値」(scripts.exit_signals)も
同じタイミングで更新する。

画面を開くたび・保存するたびに呼び出されるため、前回の実行が終わっていない間に
新しいリクエストが来ても二重にyfinanceを叩かないよう、プロセス内ロックで排他する。
"""

import logging
import threading

from sqlalchemy.engine import Engine

from scripts.app_settings import get_technical_score_candidate_threshold
from scripts.exit_signals import sync_highest_prices
from scripts.metrics_fetcher import run_technical_metrics_fetch
from scripts.screening_engine import evaluate_and_apply
from scripts.target_price import sync_target_prices
from scripts.target_symbols import get_tracked_ticker_symbols, resolve_target_symbols
from scripts.technical_score_settings import build_scoring_config, get_technical_score_settings
from scripts.technical_screener import (
    apply_score_candidates,
    persist_scores,
    run_technical_screen,
    sync_score_tags,
)

logger = logging.getLogger(__name__)

_refresh_lock = threading.Lock()


def refresh_metrics_and_screening(engine: Engine) -> None:
    """対象銘柄のstock_metrics(技術指標)を最新化し、その上でscreening_engineを再実行する。

    実行中に別のトリガーから呼ばれた場合は、ロックが取れないため即座にスキップする
    (先行の実行が終わればその結果で十分反映されるため)。
    """
    if not _refresh_lock.acquire(blocking=False):
        logger.info("refresh_metrics_and_screening: already running, skip this trigger")
        return

    try:
        _run(engine)
    finally:
        _refresh_lock.release()


def _run(engine: Engine) -> None:
    symbols = resolve_target_symbols(engine)

    if symbols:
        try:
            technical_score_settings = get_technical_score_settings(engine)
            records = run_technical_screen(
                engine,
                {
                    "symbols": symbols,
                    "include_nikkei225": False,
                    "benchmark_symbol": technical_score_settings["benchmark_symbol"],
                    "history_period": technical_score_settings["history_period"],
                    "scoring": build_scoring_config(technical_score_settings),
                },
            )
            persist_scores(engine, records)
            sync_score_tags(engine, records)
            threshold = get_technical_score_candidate_threshold(engine)
            applied = apply_score_candidates(engine, threshold)
            logger.info(
                "refresh_metrics_and_screening: technical-screen scored %d symbols, applied %d candidates",
                len(records), applied,
            )
        except Exception:
            logger.exception("refresh_metrics_and_screening: technical-screen failed")

        try:
            saved = run_technical_metrics_fetch(engine, symbols)
            logger.info(
                "refresh_metrics_and_screening: technical-metrics saved %d/%d symbols", saved, len(symbols)
            )
        except Exception:
            logger.exception("refresh_metrics_and_screening: technical-metrics failed")
    else:
        logger.info("refresh_metrics_and_screening: no target symbols, skipping")

    try:
        result = evaluate_and_apply(engine)
        logger.info("refresh_metrics_and_screening: run-screening-engine result=%s", result)
    except Exception:
        logger.exception("refresh_metrics_and_screening: run-screening-engine failed")

    try:
        tracked_symbols = get_tracked_ticker_symbols(engine)
        saved = sync_target_prices(engine, tracked_symbols)
        logger.info(
            "refresh_metrics_and_screening: target-price calculated %d/%d symbols", saved, len(tracked_symbols)
        )
    except Exception:
        logger.exception("refresh_metrics_and_screening: target-price sync failed")

    try:
        sync_highest_prices(engine)
        logger.info("refresh_metrics_and_screening: highest-price sync done")
    except Exception:
        logger.exception("refresh_metrics_and_screening: highest-price sync failed")
