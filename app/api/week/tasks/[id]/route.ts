import { NextResponse } from "next/server";
import { getSettings, isUnlocked } from "@/lib/session";
import { toggleTask } from "@/lib/weeks";

/** Body is optional. `{ "completed": true | false }` sets the task to exactly
 * that state — safe to repeat, and safe from a second device whose screen is
 * out of date. With no body the task is flipped, as it always was. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const desired = typeof body?.completed === "boolean" ? (body.completed as boolean) : undefined;

  const settings = await getSettings();
  const result = await toggleTask(id, new Date(), settings.timezone, desired);

  if (result === "not-found") return NextResponse.json({ error: "No such task" }, { status: 404 });
  if (result === "locked") {
    return NextResponse.json({ error: "That day is locked — only today can be ticked" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
