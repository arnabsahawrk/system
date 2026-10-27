import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { addTask, getPlan } from "@/lib/task-templates";

/** The plan for the weeks to come: the task list and each day's tasks. */
export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json(await getPlan());
}

/** Adds a task to the list. It isn't on any day until one is switched on
 * (PUT /api/tasks/[id]/days). Like everything under /api/tasks it never changes
 * the week that's running — only what the *next* rollover snapshots. */
export async function POST(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";

  const result = await addTask(name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, task: result.task });
}
