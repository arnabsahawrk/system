import { NextResponse } from "next/server";
import { parseWeekNumber } from "@/lib/api-params";
import { isUnlocked } from "@/lib/session";
import { getWeekVerdict } from "@/lib/verdict";

/** ?week=<weekNumber> — how a finished week compares with its neighbours. */
export async function GET(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const weekNumber = parseWeekNumber(new URL(req.url).searchParams.get("week"));
  if (weekNumber === null) return NextResponse.json({ error: "week must be a positive integer" }, { status: 400 });

  const verdict = await getWeekVerdict(weekNumber);
  if (!verdict) return NextResponse.json({ error: "No finished week with that number" }, { status: 404 });
  return NextResponse.json(verdict);
}
