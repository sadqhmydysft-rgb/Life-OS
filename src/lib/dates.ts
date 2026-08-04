import type { Lang } from "./types";

export type { Lang };

export const DAY_MS = 86_400_000;

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDaysISO(iso: string, n: number): string {
  return toISO(new Date(fromISO(iso).getTime() + n * DAY_MS));
}

/** whole days from today to iso (negative = past) */
export function daysFromToday(iso: string): number {
  return Math.round((fromISO(iso).getTime() - fromISO(todayISO()).getTime()) / DAY_MS);
}

function intlLocale(lang: Lang): string {
  return lang === "fa" ? "fa-IR-u-ca-persian" : "en-US";
}

export function fmtNum(n: number, lang: Lang): string {
  return n.toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
}

export function fmtPercent(n: number, lang: Lang): string {
  return `${fmtNum(Math.round(n), lang)}٪`.replace("٪", lang === "fa" ? "٪" : "%");
}

export function fmtDate(
  iso: string,
  lang: Lang,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
): string {
  return new Intl.DateTimeFormat(intlLocale(lang), opts).format(fromISO(iso));
}

export function fmtFullDate(iso: string, lang: Lang): string {
  return fmtDate(iso, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function fmtTime(ts: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

interface CalParts {
  y: number;
  m: number;
  d: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(lang: Lang): Intl.DateTimeFormat {
  let f = partsCache.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(lang), {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    partsCache.set(lang, f);
  }
  return f;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Number() can't parse Persian/Arabic-Indic digits — normalize first */
function localizedNum(s: string): number {
  let out = "";
  for (const ch of s) {
    const fi = FA_DIGITS.indexOf(ch);
    const ai = AR_DIGITS.indexOf(ch);
    out += fi >= 0 ? String(fi) : ai >= 0 ? String(ai) : ch;
  }
  return Number(out);
}

/** calendar-aware (Jalali when fa) numeric parts of an ISO date */
export function calParts(iso: string, lang: Lang): CalParts {
  const parts = partsFormatter(lang).formatToParts(fromISO(iso));
  const get = (type: string) => localizedNum(parts.find((p) => p.type === type)?.value ?? "0");
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function weekStartDay(lang: Lang): number {
  return lang === "fa" ? 6 : 1; // Saturday for fa, Monday for en
}

export function weekStartISO(iso: string, lang: Lang): string {
  const d = fromISO(iso);
  const ws = weekStartDay(lang);
  const back = (d.getDay() - ws + 7) % 7;
  return addDaysISO(iso, -back);
}

export interface MonthCell {
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  dayLabel: string;
  isFuture: boolean;
}

export interface MonthGrid {
  title: string;
  weekdayLabels: string[];
  cells: MonthCell[];
}

/** Builds a 6-week month grid for the calendar month containing anchorISO, in the locale's calendar system. */
export function getMonthGrid(anchorISO: string, lang: Lang): MonthGrid {
  const anchor = calParts(anchorISO, lang);

  // walk back to the first day of this calendar month
  let first = anchorISO;
  for (let i = 0; i < 40; i++) {
    const prev = addDaysISO(first, -1);
    const p = calParts(prev, lang);
    if (p.y !== anchor.y || p.m !== anchor.m) break;
    first = prev;
  }

  const gridStart = weekStartISO(first, lang);
  const today = todayISO();
  const dayFmt = new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric" });
  const wdFmt = new Intl.DateTimeFormat(intlLocale(lang), { weekday: "short" });

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDaysISO(gridStart, i);
    const p = calParts(iso, lang);
    cells.push({
      iso,
      inMonth: p.y === anchor.y && p.m === anchor.m,
      isToday: iso === today,
      dayLabel: dayFmt.format(fromISO(iso)),
      isFuture: iso > today,
    });
  }

  const weekdayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekdayLabels.push(wdFmt.format(fromISO(addDaysISO(gridStart, i))));
  }

  const title = new Intl.DateTimeFormat(intlLocale(lang), {
    month: "long",
    year: "numeric",
  }).format(fromISO(first));

  return { title, weekdayLabels, cells };
}

/** navigate one calendar month from anchorISO (which must be inside the month) */
export function shiftMonth(anchorISO: string, dir: 1 | -1, lang: Lang): string {
  let probe = anchorISO;
  const anchor = calParts(anchorISO, lang);
  const targetM = ((anchor.m - 1 + dir + 12) % 12) + 1;
  const targetY = anchor.y + (dir === 1 && anchor.m === 12 ? 1 : dir === -1 && anchor.m === 1 ? -1 : 0);
  // walk forward/backward until we land inside target month, then pick its 1st-or-same-day
  for (let i = 0; i < 70; i++) {
    probe = addDaysISO(probe, dir * 7);
    const p = calParts(probe, lang);
    if (p.y === targetY && p.m === targetM) {
      // nudge to mid-month so grid anchoring is stable
      while (calParts(addDaysISO(probe, -1), lang).d < p.d) probe = addDaysISO(probe, -1);
      return probe;
    }
  }
  return probe;
}

export function greetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
