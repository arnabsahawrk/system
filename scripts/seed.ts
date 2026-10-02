/**
 * Populates a fresh database with realistic sample data so the app is
 * reviewable immediately after setup. Safe to re-run — it wipes and
 * rebuilds `weeks` and `task_templates` (never `user_settings`, so your
 * passcode/timezone/pause state survive a reseed).
 *
 * Usage: npm run db:seed   (reads DATABASE_URL from .env.local)
 */
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { getAppDayIndex, getAppWeekStartDateKey, getWeekDateKeys } from "../lib/date";
import type { DayIndex } from "../lib/types";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) process.env[match[1]!] ??= match[2]!.replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example) and retry.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
});

const TEMPLATE: Record<DayIndex, string[]> = {
  0: ["Exercise", "Work (SWE)", "Learn (English)", "Read (Book)", "Journal"],
  1: ["Exercise", "Work (SWE)", "Learn (English)", "Read (Book)", "Journal"],
  2: ["Work (SWE)", "Learn (English)", "Journal"],
  3: ["Exercise", "Work (SWE)", "Learn (English)", "Read (Book)"],
  4: ["Work (SWE)", "Learn (English)", "Journal"],
  5: ["Exercise", "Work (SWE)", "Learn (English)", "Read (Book)", "Journal"],
  6: ["Work (SWE)", "Journal"],
};

// 40 weeks (~ a year of history minus the live one) so pagination (10 per
// page) actually has something to page through — a short list never
// showed the "Load more" button at all. A touch of randomness around a
// gentle upward drift, not a flat line, so History/the averages look like
// real usage rather than a obviously synthetic staircase.
const HISTORY_WEEK_COUNT = 40;
function buildHistoryPercents(): number[] {
  const out: number[] = [];
  let base = 35;
  for (let i = 0; i < HISTORY_WEEK_COUNT; i++) {
    base = Math.min(97, Math.max(5, base + (Math.random() * 18 - 7)));
    out.push(Math.round(base));
  }
  return out;
}
const HISTORY_PERCENTS = buildHistoryPercents();

function addDays(dateKey: string, days: number): string {
  const parts = dateKey.split("-").map(Number);
  const y = parts[0] ?? 1970, m = parts[1] ?? 1, d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

async function main() {
  console.log("Wiping weeks + task_templates (leaving your settings alone)...");
  await sql`truncate weeks, task_templates restart identity cascade`;

  console.log("Inserting task templates...");
  for (const dayIndex of [0, 1, 2, 3, 4, 5, 6] as DayIndex[]) {
    const names = TEMPLATE[dayIndex];
    for (let i = 0; i < names.length; i++) {
      await sql`insert into task_templates (day_index, name, sort_order) values (${dayIndex}, ${names[i]!}, ${i})`;
    }
  }

  const [settingsRow] = await sql<{ timezone: string }[]>`select timezone from user_settings where singleton = true`;
  const timezone = settingsRow?.timezone ?? "Asia/Dhaka";
  const now = new Date();
  const currentWeekStart = getAppWeekStartDateKey(now, timezone);
  const todayIndex = getAppDayIndex(now, timezone);

  console.log(`Building ${HISTORY_PERCENTS.length} historical weeks...`);
  let weekNumber = 1;
  let cursorStart = addDays(currentWeekStart, -7 * HISTORY_PERCENTS.length);
  for (const percent of HISTORY_PERCENTS) {
    const dateKeys = getWeekDateKeys(cursorStart);
    const [week] = await sql<{ id: string }[]>`
      insert into weeks (week_number, start_date, finalized) values (${weekNumber}, ${cursorStart}, true) returning id
    `;
    for (const [dayIndex, dateKey] of dateKeys.entries()) {
      const names = TEMPLATE[dayIndex as DayIndex];
      for (let i = 0; i < names.length; i++) {
        const isDone = Math.random() * 100 < percent;
        await sql`
          insert into week_tasks (week_id, day_index, date, name, sort_order, completed)
          values (${week!.id}, ${dayIndex}, ${dateKey}, ${names[i]!}, ${i}, ${isDone})
        `;
      }
    }
    weekNumber++;
    cursorStart = addDays(cursorStart, 7);
  }

  console.log("Building the current (live) week...");
  const dateKeys = getWeekDateKeys(currentWeekStart);
  const [week] = await sql<{ id: string }[]>`
    insert into weeks (week_number, start_date) values (${weekNumber}, ${currentWeekStart}) returning id
  `;
  for (const [dayIndex, dateKey] of dateKeys.entries()) {
    const names = TEMPLATE[dayIndex as DayIndex];
    const isPast = dayIndex < todayIndex;
    for (let i = 0; i < names.length; i++) {
      const isDone = isPast && Math.random() > 0.22;
      await sql`
        insert into week_tasks (week_id, day_index, date, name, sort_order, completed)
        values (${week!.id}, ${dayIndex}, ${dateKey}, ${names[i]!}, ${i}, ${isDone})
      `;
    }
  }

  console.log(`Done. ${HISTORY_PERCENTS.length} historical weeks + live Week ${weekNumber}.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
