import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSettings, isUnlocked } from "@/lib/session";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

/** Called once per visit from the client with the browser's detected IANA
 * timezone, so "if I ever change Bangladesh to another country" resolves
 * itself the next time the app is opened from the new place — no setting
 * to remember to change by hand. */
export async function PATCH(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const timezone = typeof body?.timezone === "string" ? body.timezone : null;
  if (!timezone) return NextResponse.json({ error: "Missing timezone" }, { status: 400 });

  try {
    // Validate it's a real IANA zone before trusting it for date math.
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return NextResponse.json({ error: "Not a valid timezone" }, { status: 400 });
  }

  await sql`update user_settings set timezone = ${timezone}, updated_at = now() where singleton = true`;
  return NextResponse.json({ ok: true });
}
