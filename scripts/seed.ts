/**
 * Populates a fresh database with realistic sample data so the app is
 * reviewable immediately after setup, per the original ask: "add some
 * dummy data for the first time." Safe to re-run — it wipes and rebuilds.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/seed.ts
 */
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { getAppDayIndex, getAppWeekStartDateKey, getWeekDateKeys } from "../lib/date";
import type { DayIndex } from "../lib/types";

// tsx doesn't read .env.local the way `next dev` does, so load it by hand —
// avoids adding a dotenv dependency just for a one-off script.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  // Windows editors often save with CRLF line endings and/or a UTF-8 BOM;
  // either one silently breaks a naive parse, so handle both.
  const text = readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) process.env[match[1]!] ??= match[2]!.replace(/^["']|["']$/g, "");
  }
}

// Without this the driver quietly falls back to localhost:5432 and fails with
// a confusing ECONNREFUSED instead of saying what is actually wrong.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example) and retry.");
  process.exit(1);
}

// Same date-parsing override as lib/db.ts (kept in sync manually — a
// top-level dynamic import of lib/db.ts here doesn't play well with how tsx
// runs this file). See lib/db.ts for why this override exists.
const sql = postgres(process.env.DATABASE_URL ?? "", {
  ssl: "require",
  max: 1,
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
});

const TEMPLATE: Record<DayIndex, { name: string; emoji: string }[]> = {
  0: [
    { name: "Exercise", emoji: "\u{1F4AA}" },
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Read (Book)", emoji: "\u{1F4DA}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
  1: [
    { name: "Exercise", emoji: "\u{1F4AA}" },
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Read (Book)", emoji: "\u{1F4DA}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
  2: [
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
  3: [
    { name: "Exercise", emoji: "\u{1F4AA}" },
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Read (Book)", emoji: "\u{1F4DA}" },
  ],
  4: [
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
  5: [
    { name: "Exercise", emoji: "\u{1F4AA}" },
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Learn (English)", emoji: "\u{1F4AC}" },
    { name: "Read (Book)", emoji: "\u{1F4DA}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
  6: [
    { name: "Work (SWE)", emoji: "\u{1F4BB}" },
    { name: "Journal", emoji: "\u{1F4DD}" },
  ],
};

const HISTORY_PERCENTS = [11, 23, 45, 64, 84, 96];

function addDays(dateKey: string, days: number): string {
  const parts = dateKey.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

async function main() {
  console.log("Wiping existing data...");
  await sql`truncate weeks, task_templates, rollover_log restart identity cascade`;

  console.log("Inserting task templates...");
  for (const dayIndex of [0, 1, 2, 3, 4, 5, 6] as DayIndex[]) {
    const rows = TEMPLATE[dayIndex];
    for (let i = 0; i < rows.length; i++) {
      await sql`
        insert into task_templates (day_index, name, emoji, sort_order)
        values (${dayIndex}, ${rows[i]!.name}, ${rows[i]!.emoji}, ${i})
      `;
    }
  }

  const now = new Date();
  const [settingsRow] = await sql<{ timezone: string }[]>`
    select timezone from user_settings where singleton = true
  `;
  const timezone = settingsRow?.timezone ?? "Asia/Dhaka";
  const currentWeekStart = getAppWeekStartDateKey(now, timezone);
  const todayIndex = getAppDayIndex(now, timezone);

  console.log(`Building ${HISTORY_PERCENTS.length} historical weeks...`);
  let weekNumber = 1;
  let cursorStart = addDays(currentWeekStart, -7 * HISTORY_PERCENTS.length);
  for (const percent of HISTORY_PERCENTS) {
    const dateKeys = getWeekDateKeys(cursorStart);
    const [week] = await sql<{ id: string }[]>`
      insert into weeks (week_number, start_date, finalized) values (${weekNumber}, ${cursorStart}, true)
      returning id
    `;
    let total = 0;
    let completed = 0;
    for (const [dayIndex, dateKey] of dateKeys.entries()) {
      const [weekDay] = await sql<{ id: string }[]>`
        insert into week_days (week_id, day_index, date)
        values (${week!.id}, ${dayIndex}, ${dateKey})
        returning id
      `;
      const rows = TEMPLATE[dayIndex as DayIndex];
      for (let i = 0; i < rows.length; i++) {
        const isDone = Math.random() * 100 < percent;
        total++;
        if (isDone) completed++;
        await sql`
          insert into week_day_tasks (week_day_id, name, emoji, sort_order, completed)
          values (${weekDay!.id}, ${rows[i]!.name}, ${rows[i]!.emoji}, ${i}, ${isDone})
        `;
      }
    }
    const actualPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    await sql`update weeks set total_tasks = ${total}, completed_tasks = ${completed}, percent = ${actualPercent} where id = ${week!.id}`;
    weekNumber++;
    cursorStart = addDays(cursorStart, 7);
  }

  console.log("Building the current (live) week...");
  const dateKeys = getWeekDateKeys(currentWeekStart);
  const [week] = await sql<{ id: string }[]>`
    insert into weeks (week_number, start_date) values (${weekNumber}, ${currentWeekStart})
    returning id
  `;
  let total = 0;
  let completed = 0;
  for (const [dayIndex, dateKey] of dateKeys.entries()) {
    const [weekDay] = await sql<{ id: string }[]>`
      insert into week_days (week_id, day_index, date)
      values (${week!.id}, ${dayIndex}, ${dateKey})
      returning id
    `;
    const rows = TEMPLATE[dayIndex as DayIndex];
    const isPast = dayIndex < todayIndex;
    for (let i = 0; i < rows.length; i++) {
      const isDone = isPast && Math.random() > 0.22;
      total++;
      if (isDone) completed++;
      await sql`
        insert into week_day_tasks (week_day_id, name, emoji, sort_order, completed)
        values (${weekDay!.id}, ${rows[i]!.name}, ${rows[i]!.emoji}, ${i}, ${isDone})
      `;
    }
  }
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  await sql`update weeks set total_tasks = ${total}, completed_tasks = ${completed}, percent = ${percent} where id = ${week!.id}`;

  console.log(`Done. ${HISTORY_PERCENTS.length} historical weeks + live Week ${weekNumber}.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
