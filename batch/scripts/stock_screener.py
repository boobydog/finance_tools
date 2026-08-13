"""yfinanceの銘柄スクリーニング(条件検索)モジュール。

銘柄コードを指定せず、JSONファイルに記述した検索条件(セクター・時価総額など)を
読み込んでyfinanceのスクリーナーAPIに問い合わせ、条件に合致する銘柄情報を
配列(list[dict])として返す。CSV出力などのI/O処理は行わない。

fetch_jp_all_stocksは日本国内に存在するすべての株式銘柄のコードと名前を取得する。
一度に大量のレコードを取得しようとするとyfinanceのレスポンスが返却されないことが
あるため、yfinance_batch.fetch_paginatedを使い20件ごとにAPIリクエストを分割して
取得する。

JSON設定ファイルの書式:
    定義済みクエリを使う場合 (yf.PREDEFINED_SCREENER_QUERIES.keys() を参照):
        {"predefined": "day_gainers", "count": 25}

    カスタム条件を使う場合:
        {
          "quote_type": "equity",
          "size": 25,
          "sort_field": "eodvolume",
          "sort_asc": false,
          "query": {
            "operator": "and",
            "conditions": [
              {"operator": "eq", "field": "sector", "value": "Technology"},
              {"operator": "gte", "field": "intradaymarketcap", "value": 2000000000},
              {"operator": "is-in", "field": "exchange", "value": ["NMS", "NYQ"]}
            ]
          }
        }
"""

import json
import logging
from pathlib import Path

import yfinance as yf
from yfinance import ETFQuery, EquityQuery, FundQuery

from scripts.yfinance_batch import fetch_paginated

logger = logging.getLogger(__name__)

_LOGICAL_OPERATORS = {"and", "or"}
_QUOTE_TYPE_CLASSES = {
    "equity": EquityQuery,
    "fund": FundQuery,
    "etf": ETFQuery,
}


def _build_query(condition: dict, query_cls):
    """条件定義(dict)を再帰的にEquityQuery等のクエリオブジェクトへ変換する。"""
    operator = condition["operator"].lower()
    if operator in _LOGICAL_OPERATORS:
        sub_queries = [_build_query(sub, query_cls) for sub in condition["conditions"]]
        return query_cls(operator, sub_queries)

    value = condition["value"]
    values = value if isinstance(value, list) else [value]
    return query_cls(operator, [condition["field"], *values])


def load_screen_config(config_path: str) -> dict:
    """検索条件を記述したJSONファイルを読み込む。"""
    return json.loads(Path(config_path).read_text(encoding="utf-8"))


def fetch_screened(config_path: str) -> list[dict]:
    """JSONファイルの検索条件でyfinanceの銘柄スクリーニングを実行し、配列(list[dict])として返す。"""
    config = load_screen_config(config_path)

    if "predefined" in config:
        query = config["predefined"]
    else:
        query_cls = _QUOTE_TYPE_CLASSES[config.get("quote_type", "equity")]
        query = _build_query(config["query"], query_cls)

    try:
        response = yf.screen(
            query,
            offset=config.get("offset"),
            size=config.get("size"),
            count=config.get("count"),
            sortField=config.get("sort_field"),
            sortAsc=config.get("sort_asc"),
            userId=config.get("user_id"),
            userIdType=config.get("user_id_type"),
        )
    except Exception:
        logger.exception("Failed to run screener query: %s", config_path)
        return []

    return response.get("quotes", [])


def fetch_jp_all_stocks() -> list[dict]:
    """日本国内に存在するすべての株式銘柄のコードと名前を取得し、配列(list[dict])として返す。"""
    query = EquityQuery("eq", ["region", "jp"])

    def fetch_page(offset: int, size: int) -> list[dict]:
        try:
            response = yf.screen(query, offset=offset, size=size)
        except Exception:
            logger.exception("Failed to fetch JP stock list at offset %d", offset)
            return []
        return [
            {
                "symbol": quote.get("symbol"),
                "name": quote.get("longName") or quote.get("shortName"),
            }
            for quote in response.get("quotes", [])
        ]

    return fetch_paginated(fetch_page)
