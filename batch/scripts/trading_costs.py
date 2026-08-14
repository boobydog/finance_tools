"""売買手数料・譲渡益課税を考慮した「手数料・税引後の損益」の計算。

利確判定は現在値がターゲットプライスに達したかどうかで判断しているが、
これは手数料・税金を考慮しない「額面上の損益」でしかない。含み益がわずかな場合、
手数料と譲渡益課税(標準税率20.315%)を差し引くと実質的に利益が出ない、
あるいは損失になることがある。この誤検知を防ぐため、保有銘柄ごとに
手数料・税引後の想定純損益を計算し、利確判定の最終ゲートとして使う。

手数料はDBのtrading_fee_tiersテーブル(約定代金の金額帯ごとの片道手数料)で管理し、
設定画面から編集できる。初期値はSBI証券の現物取引「スタンダードプラン」を参考に
設定しているが、証券会社・プランによって異なるため、実際に使っている手数料表と
必ず照合すること。
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

from scripts.app_settings import get_float_setting
from scripts.sql_runner import load_sql

CAPITAL_GAINS_TAX_RATE_KEY = "capital_gains_tax_rate"
DEFAULT_CAPITAL_GAINS_TAX_RATE = 20.315


def get_capital_gains_tax_rate(engine: Engine) -> float:
    """譲渡益課税の税率(%)。NISA等の非課税口座を使っている場合は設定画面で0にする。"""
    return get_float_setting(engine, CAPITAL_GAINS_TAX_RATE_KEY, DEFAULT_CAPITAL_GAINS_TAX_RATE)


def fetch_fee_tiers(engine: Engine) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(text(load_sql("select_trading_fee_tiers.sql"))).mappings().all()
    return [dict(row) for row in rows]


def calculate_commission(trade_value: float, tiers: list[dict]) -> float:
    """約定代金に対応する片道手数料を、金額帯(ティア)テーブルから引く。"""
    for tier in tiers:
        max_value = tier["max_trade_value"]
        if max_value is None or trade_value <= float(max_value):
            return float(tier["commission"])
    return 0.0


def estimate_net_profit(
    engine: Engine,
    purchase_price: float | None,
    current_price: float | None,
    quantity: float | None,
    account_type: str = "taxable",
) -> dict:
    """手数料・税引後の想定純損益を計算する。算出に必要な情報が無い場合はNoneを返す。

    計算式: 純損益 = (売却額-売却手数料) - (購入額+購入手数料) - 譲渡益課税
    (譲渡益課税は、上記の値が黒字の場合のみ、その黒字額に税率を掛けて計算する)

    account_type="nisa"の場合、購入記録の口座種別がNISA口座であることを示す。
    NISA口座は譲渡益が非課税であり、かつ売買手数料も無料として扱う(証券会社のNISA向け
    ゼロ手数料化を想定)。account_type="taxable"(特定口座(源泉徴収あり)/一般口座)では
    従来通り手数料表・税率設定を適用する。
    """
    if purchase_price is None or current_price is None or not quantity:
        return {
            "buy_commission": None,
            "sell_commission": None,
            "gross_gain": None,
            "estimated_tax": None,
            "net_profit": None,
        }

    buy_value = purchase_price * quantity
    sell_value = current_price * quantity

    if account_type == "nisa":
        buy_commission = 0.0
        sell_commission = 0.0
        tax_rate = 0.0
    else:
        tiers = fetch_fee_tiers(engine)
        buy_commission = calculate_commission(buy_value, tiers)
        sell_commission = calculate_commission(sell_value, tiers)
        tax_rate = get_capital_gains_tax_rate(engine) / 100

    gross_gain = (sell_value - sell_commission) - (buy_value + buy_commission)
    estimated_tax = max(0.0, gross_gain) * tax_rate
    net_profit = gross_gain - estimated_tax

    return {
        "buy_commission": round(buy_commission, 2),
        "sell_commission": round(sell_commission, 2),
        "gross_gain": round(gross_gain, 2),
        "estimated_tax": round(estimated_tax, 2),
        "net_profit": round(net_profit, 2),
    }


def estimate_net_profit_for_position(engine: Engine, current_price: float | None, lots: list[dict]) -> dict:
    """複数回の買い増しに対応するため、口座種別(特定/一般 or NISA)ごとの残存数量・
    加重平均取得単価(select_position_lots.sql)を使って手数料・税引後損益を計算し、
    口座種別ごとの結果を合算する。

    NISAと特定/一般口座は税制上別勘定のため、単純に全体の平均取得単価で計算すると
    誤った税額になる(NISA分にまで課税してしまう等)。口座種別ごとに分けて計算する
    ことで、この混在を正しく扱う。
    """
    if current_price is None or not lots:
        return {
            "buy_commission": None,
            "sell_commission": None,
            "gross_gain": None,
            "estimated_tax": None,
            "net_profit": None,
        }

    totals = {"buy_commission": 0.0, "sell_commission": 0.0, "gross_gain": 0.0, "estimated_tax": 0.0, "net_profit": 0.0}
    computed = False
    for lot in lots:
        remaining_quantity = int(lot["remaining_quantity"])
        if remaining_quantity <= 0 or lot["avg_purchase_price"] is None:
            continue
        result = estimate_net_profit(
            engine, float(lot["avg_purchase_price"]), current_price, remaining_quantity, lot["account_type"]
        )
        if result["net_profit"] is None:
            continue
        computed = True
        for key in totals:
            totals[key] += result[key]

    if not computed:
        return {
            "buy_commission": None,
            "sell_commission": None,
            "gross_gain": None,
            "estimated_tax": None,
            "net_profit": None,
        }
    return {key: round(value, 2) for key, value in totals.items()}


def resolve_position_account_type(lots: list[dict]) -> str | None:
    """残存数量のある口座種別が1つならその種別、2種類以上混在していれば"mixed"、
    残存数量が無ければNoneを返す。"""
    account_types = {lot["account_type"] for lot in lots if lot["remaining_quantity"] > 0}
    if not account_types:
        return None
    if len(account_types) == 1:
        return next(iter(account_types))
    return "mixed"
