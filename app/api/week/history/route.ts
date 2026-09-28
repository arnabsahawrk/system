import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { getHistory } from "@/lib/weeks";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json(await getHistory());
}
