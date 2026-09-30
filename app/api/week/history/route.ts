import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { getHistoryPage } from "@/lib/weeks";

/** ?before=<weekNumber> pages backwards, oldest still-loaded week first —
 * i.e. "give me the 10 finalized weeks right before this one". */
export async function GET(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const before = new URL(req.url).searchParams.get("before");
  const beforeNum = before ? Number(before) : undefined;
  if (before && (!Number.isInteger(beforeNum) || (beforeNum as number) < 1)) {
    return NextResponse.json({ error: "before must be a positive integer" }, { status: 400 });
  }
  return NextResponse.json(await getHistoryPage(beforeNum));
}
