"""EDINET(金融庁の開示システム)から有価証券報告書を取得し、financial_results/
stock_metricsへ「継続性」データ(売上高・当期純利益の5期分推移とその派生指標)を
取り込む。

有価証券報告書のXBRL(type=5でCSV変換版をダウンロード可能)には、法定の
「経営指標等の推移」として直近5期分(当期/前期/前々期/三期前/四期前)の主要指標が
含まれているため、1銘柄につき最新の1書類を取得するだけで5期分の継続性が分かる
(10期分が必要な場合は別途過去の書類を追加取得する必要があるが、それは対象外)。

書類の発見は、EDINET公式の書類一覧API(日付ごとに取得)をtickerの証券コード
(secCode)で絞り込む方式で行う(やのしんAPI等の第三者ラッパーには依存しない)。
訂正有価証券報告書(doc_type_code=130)は元の書類と異なるdoc_idで提出されるため、
「未取込のdoc_id」として新規取込と同じ経路で自然に検知できる。
"""

import io
import logging
import os
import time
import zipfile
from datetime import date, datetime, timedelta

import pandas as pd
import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.sql_runner import load_sql

logger = logging.getLogger(__name__)

EDINET_LIST_URL = "https://disclosure.edinet-fsa.go.jp/api/v2/documents.json"
EDINET_DOC_URL = "https://disclosure.edinet-fsa.go.jp/api/v2/documents/{doc_id}"
REQUEST_TIMEOUT = 30

DOC_TYPE_SECURITIES_REPORT = "120"
DOC_TYPE_AMENDED_SECURITIES_REPORT = "130"
TARGET_DOC_TYPES = {DOC_TYPE_SECURITIES_REPORT, DOC_TYPE_AMENDED_SECURITIES_REPORT}

# 公式レート制限は非公開だが、コミュニティの実測目安(一覧取得は間隔を空ける、
# ダウンロードは3〜5秒間隔)に合わせて保守的に設定する。
LIST_REQUEST_INTERVAL_SECONDS = 1.0
DOWNLOAD_REQUEST_INTERVAL_SECONDS = 3.0

# 経営指標等サマリーの要素ID → フィールド名。
_SUMMARY_ELEMENT_FIELDS = {
    "jpcrp_cor:NetSalesSummaryOfBusinessResults": "revenue",
    "jpcrp_cor:NetIncomeLossSummaryOfBusinessResults": "net_income",
    "jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults": "eps",
    "jpcrp_cor:EquityToAssetRatioSummaryOfBusinessResults": "equity_ratio",
    "jpcrp_cor:RateOfReturnOnEquitySummaryOfBusinessResults": "roe",
    "jpcrp_cor:NetCashProvidedByUsedInOperatingActivitiesSummaryOfBusinessResults": "operating_cf",
}
# 古い順(四期前→当期)。経営指標等サマリーの「相対年度」ラベルと対応する。
RELATIVE_YEAR_ORDER = ["四期前", "三期前", "前々期", "前期", "当期"]
# 複数の会計区分(連結/個別)でタグ付けされている場合、連結を優先する。
_CONSOLIDATION_PRIORITY = {"連結": 0, "個別": 1, "その他": 2}


def _api_key() -> str:
    key = os.environ.get("EDINET_API_KEY")
    if not key:
        raise RuntimeError("EDINET_API_KEY が設定されていません(.envを確認してください)")
    return key


def _sec_code_to_ticker(sec_code: str | None) -> str | None:
    """EDINETのsecCode(5桁、末尾0埋め)を証券コード.T形式へ変換する。"""
    if not sec_code or len(sec_code) < 4:
        return None
    return f"{sec_code[:4]}.T"


def _get(url: str, params: dict, *, sanitized_url_for_errors: str) -> requests.Response:
    """requests.getのラッパー。例外メッセージにAPIキー(クエリパラメータ)が含まれて
    ログに漏洩するのを防ぐため、例外発生時はURLを伏せた別の例外に置き換える。
    """
    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"EDINET APIリクエストに失敗しました: {sanitized_url_for_errors} ({type(exc).__name__})") from None


def list_documents(target_date: date) -> list[dict]:
    """指定日にEDINETへ提出された書類の一覧を取得する。"""
    params = {"date": target_date.isoformat(), "type": "2", "Subscription-Key": _api_key()}
    response = _get(EDINET_LIST_URL, params, sanitized_url_for_errors=f"{EDINET_LIST_URL}?date={target_date.isoformat()}")
    return response.json().get("results", [])


def _parse_business_results_summary(zip_bytes: bytes) -> dict[str, dict] | None:
    """type=5のZIPから経営指標等サマリーCSVを抽出し、相対年度ごとの値を返す。"""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        candidates = [n for n in z.namelist() if "jpcrp" in n and n.endswith(".csv")]
        if not candidates:
            return None
        data = z.read(candidates[0])

    df = pd.read_csv(io.BytesIO(data), sep="\t", encoding="utf-16")
    df = df[df["要素ID"].isin(_SUMMARY_ELEMENT_FIELDS)]
    if df.empty:
        return None

    df["_field"] = df["要素ID"].map(_SUMMARY_ELEMENT_FIELDS)
    df["_priority"] = df["連結・個別"].map(_CONSOLIDATION_PRIORITY).fillna(9)
    # 相対年度×フィールドで重複がある場合(連結/個別の両方がタグ付けされている場合)は
    # 優先度が最も高い(連結 > 個別 > その他)行のみ残す。
    df = df.sort_values("_priority").drop_duplicates(subset=["相対年度", "_field"], keep="first")

    periods: dict[str, dict] = {}
    for relative_year in RELATIVE_YEAR_ORDER:
        rows = df[df["相対年度"].astype(str).str.startswith(relative_year)]
        if rows.empty:
            continue
        values = {}
        for _, row in rows.iterrows():
            try:
                values[row["_field"]] = float(row["値"])
            except (TypeError, ValueError):
                continue
        if values:
            periods[relative_year] = values

    return periods or None


def _fiscal_period_dates(period_end: date) -> dict[str, date]:
    """当期の期末日から、各相対年度の期末日を逆算する(年1回決算・期末日不変を仮定)。"""
    offsets = {"当期": 0, "前期": 1, "前々期": 2, "三期前": 3, "四期前": 4}
    result = {}
    for label, years_back in offsets.items():
        try:
            result[label] = period_end.replace(year=period_end.year - years_back)
        except ValueError:
            # 閏日(2/29)などreplaceが失敗するケースは2/28に丸める。
            result[label] = period_end.replace(month=2, day=28, year=period_end.year - years_back)
    return result


def download_business_results_summary(doc_id: str) -> dict[str, dict] | None:
    """有価証券報告書(type=5, CSV変換済みXBRL)から経営指標等サマリーを取得する。"""
    params = {"type": "5", "Subscription-Key": _api_key()}
    url = EDINET_DOC_URL.format(doc_id=doc_id)
    response = _get(url, params, sanitized_url_for_errors=f"{url}?type=5")
    try:
        return _parse_business_results_summary(response.content)
    except Exception:
        logger.warning("Failed to parse business results summary for doc_id=%s", doc_id, exc_info=True)
        return None


def _compute_continuity(revenue_by_year: list[float | None], net_income_by_year: list[float | None]) -> dict:
    """古い順(四期前→当期)のリストからCAGR・連続成長/黒字年数を計算する。"""
    result = {
        "revenue_cagr_5y": None,
        "net_income_cagr_5y": None,
        "consecutive_revenue_growth_years": None,
        "consecutive_profit_years": None,
    }

    if revenue_by_year[0] is not None and revenue_by_year[-1] is not None and revenue_by_year[0] > 0:
        intervals = len(revenue_by_year) - 1
        result["revenue_cagr_5y"] = ((revenue_by_year[-1] / revenue_by_year[0]) ** (1 / intervals) - 1) * 100

    if (
        net_income_by_year[0] is not None
        and net_income_by_year[-1] is not None
        and net_income_by_year[0] > 0
        and net_income_by_year[-1] > 0
    ):
        intervals = len(net_income_by_year) - 1
        result["net_income_cagr_5y"] = ((net_income_by_year[-1] / net_income_by_year[0]) ** (1 / intervals) - 1) * 100

    # 当期から遡って、前年より増加し続けている年数。
    streak = 0
    for i in range(len(revenue_by_year) - 1, 0, -1):
        cur, prev = revenue_by_year[i], revenue_by_year[i - 1]
        if cur is None or prev is None or not (cur > prev):
            break
        streak += 1
    result["consecutive_revenue_growth_years"] = streak

    # 当期から遡って、黒字であり続けている年数。
    streak = 0
    for i in range(len(net_income_by_year) - 1, -1, -1):
        v = net_income_by_year[i]
        if v is None or not (v > 0):
            break
        streak += 1
    result["consecutive_profit_years"] = streak

    return result


def _ingest_filing(engine: Engine, ticker_symbol: str, doc: dict, period_end: date) -> bool:
    """1件の書類をダウンロード・パースし、financial_results/stock_metricsへ反映する。"""
    doc_id = doc["docID"]
    summary = download_business_results_summary(doc_id)
    if not summary:
        logger.warning("No business results summary found for %s (doc_id=%s)", ticker_symbol, doc_id)
        return False

    fiscal_dates = _fiscal_period_dates(period_end)
    revenue_by_year: list[float | None] = []
    net_income_by_year: list[float | None] = []

    rows = []
    for relative_year in RELATIVE_YEAR_ORDER:
        values = summary.get(relative_year)
        revenue_by_year.append(values.get("revenue") if values else None)
        net_income_by_year.append(values.get("net_income") if values else None)
        if not values:
            continue
        fiscal_end = fiscal_dates[relative_year]
        rows.append(
            {
                "ticker_symbol": ticker_symbol,
                "fiscal_period": f"FY{fiscal_end.year}",
                # 円 → 百万円(他の金額項目と同じ単位規約に統一)。
                "revenue": round(values["revenue"] / 1_000_000) if values.get("revenue") is not None else None,
                "net_income": round(values["net_income"] / 1_000_000) if values.get("net_income") is not None else None,
                "eps": values.get("eps"),
                # 比率(0.845)を%表記(84.5)へ変換し、既存のequity_ratio/roeの規約に合わせる。
                "equity_ratio": values["equity_ratio"] * 100 if values.get("equity_ratio") is not None else None,
                "roe": values["roe"] * 100 if values.get("roe") is not None else None,
                "operating_cf": round(values["operating_cf"] / 1_000_000) if values.get("operating_cf") is not None else None,
            }
        )

    if not rows:
        return False

    continuity = _compute_continuity(revenue_by_year, net_income_by_year)

    with engine.begin() as conn:
        for row in rows:
            conn.execute(text(load_sql("upsert_financial_result.sql")), row)
        conn.execute(
            text(load_sql("upsert_financial_continuity.sql")),
            {"ticker_symbol": ticker_symbol, **continuity},
        )
        conn.execute(
            text(load_sql("insert_edinet_filing.sql")),
            {
                "doc_id": doc_id,
                "ticker_symbol": ticker_symbol,
                "edinet_code": doc.get("edinetCode"),
                "doc_type_code": doc.get("docTypeCode"),
                "period_end": period_end,
                "submitted_at": doc.get("submitDateTime"),
            },
        )
    return True


def sync_filings(engine: Engine, symbols: list[str], lookback_days: int) -> dict:
    """直近lookback_days分のEDINET書類一覧を走査し、対象銘柄の有価証券報告書
    (新規・訂正)をfinancial_results/stock_metricsへ取り込む。

    バックフィル(lookback_days大)・日次巡回(lookback_days小)の両方をこの関数で
    共有する。訂正報告書(doc_type_code=130)は元の書類と異なるdoc_idを持つため、
    通常の新規取込と同じ経路でそのまま検知・上書きされる。
    """
    tracked = {s for s in symbols}
    today = date.today()
    dates_scanned = 0
    docs_matched = 0
    docs_ingested = 0
    tickers_updated: set[str] = set()

    with engine.connect() as conn:
        already_ingested = lambda doc_id: conn.execute(
            text(load_sql("select_edinet_filing_by_doc_id.sql")), {"doc_id": doc_id}
        ).first() is not None

        for offset in range(lookback_days):
            target_date = today - timedelta(days=offset)
            try:
                docs = list_documents(target_date)
            except Exception:
                logger.warning("Failed to list EDINET documents for %s", target_date, exc_info=True)
                continue
            dates_scanned += 1
            time.sleep(LIST_REQUEST_INTERVAL_SECONDS)

            for doc in docs:
                if doc.get("docTypeCode") not in TARGET_DOC_TYPES:
                    continue
                ticker = _sec_code_to_ticker(doc.get("secCode"))
                if ticker is None or ticker not in tracked:
                    continue
                if already_ingested(doc["docID"]):
                    continue

                docs_matched += 1
                period_end_str = doc.get("periodEnd")
                if not period_end_str:
                    continue
                period_end = datetime.strptime(period_end_str, "%Y-%m-%d").date()

                try:
                    ingested = _ingest_filing(engine, ticker, doc, period_end)
                except Exception:
                    logger.exception("Failed to ingest EDINET filing %s for %s", doc["docID"], ticker)
                    ingested = False
                time.sleep(DOWNLOAD_REQUEST_INTERVAL_SECONDS)

                if ingested:
                    docs_ingested += 1
                    tickers_updated.add(ticker)

    return {
        "dates_scanned": dates_scanned,
        "docs_matched": docs_matched,
        "docs_ingested": docs_ingested,
        "tickers_updated": len(tickers_updated),
    }
