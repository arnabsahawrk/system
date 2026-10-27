import { NextResponse } from "next/server";
import { parseWeekNumber } from "@/lib/api-params";
import { setNote } from "@/lib/notes";
import { isUnlocked } from "@/lib/session";

/** Writes the note on a finished week: added the first time, changeable once
 * after that, then final (409). Only ever touches the note — never the week's
 * tasks. */
export async function PUT(req: Request, { params }: { params: Promise<{ weekNumber: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const weekNumber = parseWeekNumber((await params).weekNumber);
  if (weekNumber === null) return NextResponse.json({ error: "Not a valid week" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (typeof body?.note !== "string") {
    return NextResponse.json({ error: "note must be text" }, { status: 400 });
  }

  const result = await setNote(weekNumber, body.note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, note: result.note, edited: result.edited });
}
