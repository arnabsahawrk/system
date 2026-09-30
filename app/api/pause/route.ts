import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { isUnlocked, verifyPasscode } from "@/lib/session";

/**
 * Requesting a pause or a resume — passcode-gated (re-entered here even
 * though the session is already unlocked) since it stops all data
 * collection and email. Neither action is instant: see lib/rollover.ts for
 * why this only ever writes an *intent*, applied at the next boundary.
 */
export async function POST(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (action !== "pause" && action !== "resume" && action !== "cancel") {
    return NextResponse.json({ error: "action must be pause, resume, or cancel" }, { status: 400 });
  }
  if (!(await verifyPasscode(passcode))) {
    return NextResponse.json({ error: "That passcode isn't right" }, { status: 401 });
  }

  const [row] = await sql<{ paused: boolean }[]>`select paused from user_settings where singleton = true`;
  const isPaused = row?.paused ?? false;

  if (action === "cancel") {
    await sql`update user_settings set pending_action = null, updated_at = now() where singleton = true`;
    return NextResponse.json({ ok: true });
  }
  if (action === "pause" && isPaused) {
    return NextResponse.json({ error: "Already paused" }, { status: 400 });
  }
  if (action === "resume" && !isPaused) {
    return NextResponse.json({ error: "Not paused" }, { status: 400 });
  }

  await sql`update user_settings set pending_action = ${action}, updated_at = now() where singleton = true`;
  return NextResponse.json({ ok: true });
}
