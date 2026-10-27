import { NextResponse } from "next/server";
import { isUuid } from "@/lib/api-params";
import { isUnlocked } from "@/lib/session";
import { removeTask } from "@/lib/task-templates";

/** Deletes a task from the list and from every day it was on. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not a valid task" }, { status: 400 });
  await removeTask(id);
  return NextResponse.json({ ok: true });
}
