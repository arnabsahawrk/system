import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { removeTemplateTask, renameTemplateTask } from "@/lib/task-templates";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";
  const emoji = typeof body?.emoji === "string" && body.emoji ? body.emoji : undefined;

  const result = await renameTemplateTask(id, name, emoji);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  await removeTemplateTask(id);
  return NextResponse.json({ ok: true });
}
