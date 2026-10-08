import { NextResponse } from "next/server";
import { parseWeekNumber } from "@/lib/api-params";
import { isUnlocked } from "@/lib/session";
import { getWeekDetail } from "@/lib/weeks";

/** One finished week with every task — the Records post-mortem. */
export async function GET(_req: Request, { params }: { params: Promise<{ weekNumber: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const weekNumber = parseWeekNumber((await params).weekNumber);
  if (weekNumber === null) return NextResponse.json({ error: "Not a valid week" }, { status: 400 });

  const detail = await getWeekDetail(weekNumber);
  if (!detail) return NextResponse.json({ error: "No finished week with that number" }, { status: 404 });
  return NextResponse.json(detail);
}
