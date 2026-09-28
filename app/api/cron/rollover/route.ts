import { NextResponse } from "next/server";
import { ensureCurrentWeek } from "@/lib/rollover";

export const maxDuration = 60;

/**
 * Runs on a schedule (vercel.json) as a backup to the lazy check that
 * already happens on every dashboard load — see lib/weeks.ts getCurrentWeek.
 * That lazy check means data is *never* wrong even if this never fires;
 * this only exists so the weekly email arrives close to the real 6am
 * boundary instead of whenever the app next happens to be opened.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureCurrentWeek(new Date());
  return NextResponse.json({ ok: true });
}
