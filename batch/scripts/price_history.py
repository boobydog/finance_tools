"""株価チャート向けのOHLCV集計(日足→週足/月足への変換)。"""

import pandas as pd

_RESAMPLE_RULE = {"weekly": "W", "monthly": "ME"}


def aggregate_price_history(rows: list[dict], interval: str) -> list[dict]:
    """dailyの行データを指定間隔(daily/weekly/monthly)に集計する。"""
    if interval == "daily" or not rows:
        return rows

    df = pd.DataFrame(rows).set_index("date")
    df.index = pd.to_datetime(df.index)
    aggregated = (
        df.resample(_RESAMPLE_RULE[interval])
        .agg(
            {
                "open_price": "first",
                "high_price": "max",
                "low_price": "min",
                "close_price": "last",
                "volume": "sum",
            }
        )
        .dropna(subset=["close_price"])
        .reset_index()
    )
    return [
        {
            "date": row["date"].date(),
            "open_price": row["open_price"],
            "high_price": row["high_price"],
            "low_price": row["low_price"],
            "close_price": row["close_price"],
            "volume": int(row["volume"]),
        }
        for _, row in aggregated.iterrows()
    ]
