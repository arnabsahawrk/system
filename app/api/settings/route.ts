import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSettings, isUnlocked } from "@/lib/session";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

/** Called once per visit from the client with the browser's detected IANA
 * timezone, so "if I ever change country" resolves itself the next time
 * the app is opened from the new place. Also handles the simple
 * notifications on/off toggle (the pause toggle lives in /api/pause,
 * since that one needs passcode re-verification). */
export async function PATCH(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (typeof body?.timezone === "string") {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
    } catch {
      return NextResponse.json({ error: "Not a valid timezone" }, { status: 400 });
    }
    await sql`update user_settings set timezone = ${body.timezone}, updated_at = now() where singleton = true`;
  }

  if (typeof body?.notificationsEnabled === "boolean") {
    await sql`update user_settings set notifications_enabled = ${body.notificationsEnabled}, updated_at = now() where singleton = true`;
  }

  return NextResponse.json({ ok: true });
}
