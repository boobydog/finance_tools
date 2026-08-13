"""東証の取引時間判定。

平日9:00-11:30(前場)・12:30-15:30(後場)のみを取引時間とする。
祝日カレンダーには対応していない(平日判定のみ)。
"""

from datetime import datetime, time
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

MORNING_SESSION = (time(9, 0), time(11, 30))
AFTERNOON_SESSION = (time(12, 30), time(15, 30))


def is_tse_open(now: datetime | None = None) -> bool:
    """現在(またはnow)が東証の取引時間内かどうかを返す。"""
    current = (now or datetime.now(JST)).astimezone(JST)
    if current.weekday() >= 5:  # 5=土, 6=日
        return False
    current_time = current.time()
    return (
        MORNING_SESSION[0] <= current_time <= MORNING_SESSION[1]
        or AFTERNOON_SESSION[0] <= current_time <= AFTERNOON_SESSION[1]
    )
