// תאריכים כמחרוזות YYYY-MM-DD, בלי אזורי זמן מתעתעים.

export const pad = (n: number) => String(n).padStart(2, "0");

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** היום לפי השעון המקומי של הדפדפן */
export function todayStr(): string {
  return toYMD(new Date());
}

/** היום לפי שעון ישראל (לשרת) */
export function todayIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(ymd: string, n: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

/** יום ראשון של השבוע שבו נמצא התאריך */
export function startOfWeek(ymd: string): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() - d.getDay());
  return toYMD(d);
}

export function weekdayName(ymd: string): string {
  return parseYMD(ymd).toLocaleDateString("he-IL", { weekday: "long" });
}

export function formatShort(ymd: string): string {
  return parseYMD(ymd).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export function formatLong(ymd: string): string {
  return parseYMD(ymd).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** תאריך בשעון ישראל של חותמת זמן ISO */
export function ymdOfIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
