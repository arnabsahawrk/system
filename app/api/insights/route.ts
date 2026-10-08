import { NextResponse } from "next/server";
import { getInsights } from "@/lib/insights-db";
import { ensureCurrentWeek } from "@/lib/rollover";
import { isUnlocked } from "@/lib/session";

/** Streaks, bests, weekday shape, task consistency and the tick clock —
 * all computed from the task rows on every request, nothing stored. */
export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const now = new Date();
  // Opening Insights straight after 06:00 Saturday must see the new week, not
  // wait for the dashboard to have run the rollover first.
  await ensureCurrentWeek(now);
  return NextResponse.json(await getInsights(now));
}
