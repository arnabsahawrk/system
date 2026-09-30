import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { getCurrentWeek } from "@/lib/weeks";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const week = await getCurrentWeek(new Date());
  // null means: paused, and no week has ever been started (or the last one
  // ended exactly at pause with nothing new created) — a real, valid state,
  // not an error. The dashboard renders its "paused" screen for this.
  return NextResponse.json(week);
}
