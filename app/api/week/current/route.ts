import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { getCurrentWeek } from "@/lib/weeks";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const week = await getCurrentWeek(new Date());
  return NextResponse.json(week);
}
