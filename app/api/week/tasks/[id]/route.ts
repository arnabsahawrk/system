import { NextResponse } from "next/server";
import { getSettings, isUnlocked } from "@/lib/session";
import { toggleTask } from "@/lib/weeks";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  const settings = await getSettings();
  const result = await toggleTask(id, new Date(), settings.timezone);

  if (result === "not-found") return NextResponse.json({ error: "No such task" }, { status: 404 });
  if (result === "locked") {
    return NextResponse.json({ error: "That day is locked — only today can be ticked" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
