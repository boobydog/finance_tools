"""テクニカルスコア計算式(technical_screener.py)の各種パラメータ(重み・期間・閾値)を
app_settingsテーブルから読み込む。

Stage2/相対強度(RS)/出来高急増/RSI適温ゾーン/VCP・52週高値圏/MACD上昇モメンタムの
6要素それぞれについて、配点・期間・閾値を設定画面(テクニカルスコア設定)から編集できる
ようにするため、定数をここに集約している。デフォルト値は元々コードにハードコードされて
いた値をそのまま踏襲しており、未設定(app_settingsに行が無い)の間は従来と同じ挙動になる。
"""

from sqlalchemy.engine import Engine

from scripts.app_settings import get_float_setting, get_int_setting, get_str_setting, set_setting

# フィールド名 -> (app_settingsのキー, デフォルト値)
_INT_FIELDS: dict[str, tuple[str, int]] = {
    "stage2_points": ("technical_score_stage2_points", 30),
    "stage2_sma_short_period": ("technical_score_stage2_sma_short_period", 50),
    "stage2_sma_long_period": ("technical_score_stage2_sma_long_period", 200),
    "stage2_trend_lookback_days": ("technical_score_stage2_trend_lookback_days", 20),
    "rs_points": ("technical_score_rs_points", 25),
    "rs_lookback_days": ("technical_score_rs_lookback_days", 126),
    "volume_points": ("technical_score_volume_points", 20),
    "volume_average_period": ("technical_score_volume_average_period", 20),
    "rsi_points": ("technical_score_rsi_points", 15),
    "rsi_period": ("technical_score_rsi_period", 14),
    "rsi_comfort_low": ("technical_score_rsi_comfort_low", 45),
    "rsi_comfort_high": ("technical_score_rsi_comfort_high", 65),
    "rsi_overbought_threshold": ("technical_score_rsi_overbought_threshold", 70),
    "rsi_overbought_penalty": ("technical_score_rsi_overbought_penalty", -10),
    "vcp_points": ("technical_score_vcp_points", 10),
    "vcp_volatility_lookback_days": ("technical_score_vcp_volatility_lookback_days", 10),
    "vcp_atr_period": ("technical_score_vcp_atr_period", 14),
    "vcp_history_lookback_days": ("technical_score_vcp_history_lookback_days", 252),
    "macd_points": ("technical_score_macd_points", 15),
    "macd_fast_period": ("technical_score_macd_fast_period", 12),
    "macd_slow_period": ("technical_score_macd_slow_period", 26),
    "macd_signal_period": ("technical_score_macd_signal_period", 9),
}

_FLOAT_FIELDS: dict[str, tuple[str, float]] = {
    "rs_threshold": ("technical_score_rs_threshold", 1.3),
    "volume_ratio_threshold": ("technical_score_volume_ratio_threshold", 1.5),
    "vcp_high52w_ratio_threshold": ("technical_score_vcp_high52w_ratio_threshold", 0.95),
}

_STR_FIELDS: dict[str, tuple[str, str]] = {
    "benchmark_symbol": ("technical_score_benchmark_symbol", "^N225"),
    "history_period": ("technical_score_history_period", "2y"),
}

ALL_FIELDS: dict[str, tuple[str, int | float | str]] = {**_INT_FIELDS, **_FLOAT_FIELDS, **_STR_FIELDS}


def get_technical_score_settings(engine: Engine) -> dict[str, int | float | str]:
    """設定画面向けの平坦な設定値一式を返す(フィールド名 -> 値)。"""
    values: dict[str, int | float | str] = {}
    for field, (key, default) in _INT_FIELDS.items():
        values[field] = get_int_setting(engine, key, default)
    for field, (key, default) in _FLOAT_FIELDS.items():
        values[field] = get_float_setting(engine, key, default)
    for field, (key, default) in _STR_FIELDS.items():
        values[field] = get_str_setting(engine, key, default)
    return values


def set_technical_score_settings(engine: Engine, values: dict[str, int | float | str]) -> None:
    """設定画面からの一括更新。"""
    for field, value in values.items():
        key, _default = ALL_FIELDS[field]
        set_setting(engine, key, value)


def build_scoring_config(settings: dict[str, int | float | str]) -> dict:
    """get_technical_score_settings()の平坦な値を、run_technical_screen()が期待する
    ネスト形式(用途別のcfg辞書)へ組み立てる。"""
    return {
        "stage2": {
            "points": settings["stage2_points"],
            "sma_short_period": settings["stage2_sma_short_period"],
            "sma_long_period": settings["stage2_sma_long_period"],
            "sma_long_trend_lookback_days": settings["stage2_trend_lookback_days"],
        },
        "relative_strength": {
            "points": settings["rs_points"],
            "lookback_days": settings["rs_lookback_days"],
            "threshold": settings["rs_threshold"],
        },
        "volume_surge": {
            "points": settings["volume_points"],
            "average_period": settings["volume_average_period"],
            "ratio_threshold": settings["volume_ratio_threshold"],
        },
        "rsi_zone": {
            "points": settings["rsi_points"],
            "period": settings["rsi_period"],
            "comfort_low": settings["rsi_comfort_low"],
            "comfort_high": settings["rsi_comfort_high"],
            "overbought_threshold": settings["rsi_overbought_threshold"],
            "overbought_penalty": settings["rsi_overbought_penalty"],
        },
        "vcp_or_high": {
            "points": settings["vcp_points"],
            "high_52w_ratio_threshold": settings["vcp_high52w_ratio_threshold"],
            "volatility_lookback_days": settings["vcp_volatility_lookback_days"],
            "atr_period": settings["vcp_atr_period"],
            "history_lookback_days": settings["vcp_history_lookback_days"],
        },
        "macd": {
            "points": settings["macd_points"],
            "fast_period": settings["macd_fast_period"],
            "slow_period": settings["macd_slow_period"],
            "signal_period": settings["macd_signal_period"],
        },
    }
