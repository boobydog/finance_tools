// 東証の取引時間判定(平日9:00-11:30・12:30-15:30 JST)。祝日カレンダーは未対応。
// バックエンド(scripts/market_hours.py)と同じルール。

function jstParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    minutesSinceMidnight: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const MORNING_SESSION = [9 * 60, 11 * 60 + 30] as const;
const AFTERNOON_SESSION = [12 * 60 + 30, 15 * 60 + 30] as const;

export function isTseMarketOpen(date: Date = new Date()): boolean {
  const { weekday, minutesSinceMidnight: t } = jstParts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return (
    (t >= MORNING_SESSION[0] && t <= MORNING_SESSION[1]) ||
    (t >= AFTERNOON_SESSION[0] && t <= AFTERNOON_SESSION[1])
  );
}
