import { NextResponse } from "next/server";
import { getSettings, isUnlocked } from "@/lib/session";
import { getCurrentWeek } from "@/lib/weeks";

/** The live week and the settings, in one round trip. The rollover check
 * inside getCurrentWeek can change settings as a side effect (a pending
 * start date, paused flipping on its own), so settings are read *after* it —
 * and sending them together saves the dashboard a second sequential request
 * on every load, which is most of what "feels slow" on a weak connection. */
export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const week = await getCurrentWeek(new Date());
  // week === null means: paused, and no week has ever been started (or the
  // last one ended exactly at pause with nothing new created) — a real,
  // valid state, not an error. The dashboard renders its "paused" screen.
  const settings = await getSettings();
  return NextResponse.json({ week, settings });
}
