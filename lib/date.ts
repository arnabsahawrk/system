import type { DayIndex } from "./types";

/**
 * === The one rule everything else in this file exists to implement ===
 *
 * System's "day" doesn't flip at midnight — it flips at 6:00 AM local time.
 * So at 5:59 AM Saturday, you're still inside "Friday": Friday's card is
 * still unlocked and you can still tick it.
 *
 * System's "week" is the same idea one level up: it runs Saturday 06:00 to
 * the following Saturday 06:00. Both rules fall out of one shift: subtract
 * RESET_HOUR from the current wall-clock time before doing any day/week
 * math, in the timezone the user is actually in.
 *
 * Everything below is a pure function of (now, timeZone) — there is no
 * hidden state, no setInterval, nothing to get out of sync. Call these
 * fresh on every request/render and the lock state is always correct,
 * with zero dependency on any cron job.
 */

export const RESET_HOUR = 6;

/** 0 = Saturday … 6 = Friday, matching how the day cards are laid out. */
export const WEEK_DAY_ORDER: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  // Some locales/environments report midnight as "24" under hour12:false.
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Returns a Date whose UTC getters (getUTCFullYear, getUTCDay, etc.) report
 * the *wall-clock* time in `timeZone` — e.g. if it's 11:30 PM in Dhaka, the
 * returned Date's getUTCHours() is 23, regardless of the machine's own
 * timezone. This lets the rest of the file do plain date arithmetic without
 * a timezone library.
 */
function zonedWallClockAsUtc(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

/** The wall-clock moment, shifted back by RESET_HOUR. This is the value
 * every other function in this file is built on. */
function getAppMoment(now: Date, timeZone: string): Date {
  const zoned = zonedWallClockAsUtc(now, timeZone);
  return new Date(zoned.getTime() - RESET_HOUR * 60 * 60 * 1000);
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS getUTCDay() is 0=Sun..6=Sat. System's week is 0=Sat..6=Fri. */
function jsDayToAppDayIndex(jsDay: number): DayIndex {
  return (((jsDay + 1) % 7) as DayIndex);
}

/** Which app-day (0=Sat..6=Fri) "now" currently belongs to. */
export function getAppDayIndex(now: Date, timeZone: string): DayIndex {
  const appMoment = getAppMoment(now, timeZone);
  return jsDayToAppDayIndex(appMoment.getUTCDay());
}

/** The calendar date (YYYY-MM-DD) of the app-day "now" currently belongs to. */
export function getAppDateKey(now: Date, timeZone: string): string {
  return toDateKey(getAppMoment(now, timeZone));
}

/** The calendar date (YYYY-MM-DD) of the Saturday that starts the current
 * app-week. This is the value a "which week is this?" DB lookup keys on. */
export function getAppWeekStartDateKey(now: Date, timeZone: string): string {
  const appMoment = getAppMoment(now, timeZone);
  const dayIndex = jsDayToAppDayIndex(appMoment.getUTCDay());
  const weekStart = new Date(appMoment.getTime() - dayIndex * 24 * 60 * 60 * 1000);
  return toDateKey(weekStart);
}

/** Parses a "YYYY-MM-DD" string produced by this file's own toDateKey. */
export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const parts = dateKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: "${dateKey}"`);
  }
  return { year, month, day };
}

export type WeekDateKeys = [string, string, string, string, string, string, string];

/** The 7 calendar dates (Sat..Fri) making up the app-week that starts on
 * `weekStartDateKey` (a YYYY-MM-DD string, as returned by the function above). */
export function getWeekDateKeys(weekStartDateKey: string): WeekDateKeys {
  const { year, month, day } = parseDateKey(weekStartDateKey);
  const start = new Date(Date.UTC(year, month - 1, day));
  return WEEK_DAY_ORDER.map((i) =>
    toDateKey(new Date(start.getTime() + i * 86400000))
  ) as WeekDateKeys;
}

/** True if `dateKey` is the one unlocked day, given the current moment. */
export function isUnlockedDate(dateKey: string, now: Date, timeZone: string): boolean {
  return dateKey === getAppDateKey(now, timeZone);
}

/** Best-effort IANA timezone from the browser. Call only on the client. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  } catch {
    return "Asia/Dhaka";
  }
}

/** Human label for a day index, e.g. 0 -> "Saturday". Kept here (not just in
 * types.ts) so call sites that already import from "./date" don't need a
 * second import for something this closely related. */
export { DAY_LABELS, DAY_SHORT_LABELS } from "./types";
