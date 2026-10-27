"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Lock, Pencil, X } from "lucide-react";
import { NOTE_MAX_LENGTH } from "@/lib/goals";
import { goToUnlock } from "@/lib/nav";

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * The note on a finished week. Three states, in this order:
 *  1. No note yet — an open field. Saving (the button, Enter, or leaving the
 *     field) adds it.
 *  2. A note — the field is shut. A pencil opens it once; saving uses up that
 *     one change (it only saves from the button or Enter, never by accident).
 *  3. Changed once — the field stays shut and shows a lock. The note is final.
 * Saving only ever writes the note: the week's tasks are frozen and never
 * touched from here. The server enforces all of this, so a second device or a
 * hand-made request can't get around it.
 */
export function NoteEditor({
  weekNumber,
  saved,
  edited,
  onSaved,
}: {
  weekNumber: number;
  /** The note as saved; "" when there is none. */
  saved: string;
  /** True once the one allowed change has been used. */
  edited: boolean;
  onSaved: (weekNumber: number, note: string, edited: boolean) => void;
}) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const [value, setValue] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const hasNote = saved !== "";
  const open = !hasNote || editing; // the field takes typing
  const clean = tidy(value);
  const canSave = open && clean !== "" && clean !== saved && !saving;
  const shown = open ? value : saved;

  // Grow the field with its text, so a long note is shown whole.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [shown]);

  useEffect(() => {
    if (!editing) return;
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  function startEdit() {
    setValue(saved);
    setError(null);
    setFlash(false);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setValue(saved);
    setError(null);
  }

  async function save() {
    if (!canSave || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/week/${weekNumber}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: value }),
      });
      if (res.status === 401) {
        goToUnlock();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { note?: string; edited?: boolean; error?: string };
      if (!res.ok || typeof json.note !== "string") {
        setError(json.error ?? "Couldn't save. Try again.");
        return;
      }
      setValue(json.note);
      setEditing(false);
      onSaved(weekNumber, json.note, json.edited === true);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1800);
    } catch {
      setError("Couldn't save. Check the connection and try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex min-h-[24px] items-center justify-between">
        <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Week note
        </label>
        {hasNote && !editing && (
          edited ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint">
              <Lock size={11} aria-hidden="true" /> Final
            </span>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit note (one change allowed)"
              className="rounded-md p-1.5 text-ink-muted transition-all duration-200 hover:bg-white/[0.06] hover:text-ink active:scale-90"
            >
              <Pencil size={14} />
            </button>
          )
        )}
      </div>

      <textarea
        ref={field}
        id={id}
        rows={1}
        value={shown}
        readOnly={!open}
        tabIndex={open ? 0 : -1}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="What happened this week? (optional)"
        onChange={(e) => {
          setValue(e.target.value.replace(/[\r\n]+/g, " "));
          setError(null);
          setFlash(false);
        }}
        // Adding a note first time saves when you leave the field, so a typed
        // note is never lost. Changing one never does: that single change is
        // only spent on purpose.
        onBlur={() => {
          if (!hasNote) void save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape" && editing) {
            cancel();
          }
        }}
        className={`block w-full resize-none overflow-hidden rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-colors duration-200 placeholder:text-ink-faint ${
          open
            ? "border-border bg-black/20 text-ink focus:border-accent/60"
            : "cursor-default border-transparent bg-white/[0.04] text-ink"
        }`}
      />

      <div className="mt-2 flex min-h-[32px] items-center justify-between gap-3">
        <p
          className={`min-w-0 font-mono text-[10px] leading-snug ${
            error ? "text-clay-strong" : editing ? "text-clay-strong" : flash ? "text-accent-strong" : "text-ink-faint"
          }`}
          aria-live="polite"
        >
          {error ??
            (editing ? "You can change this once." : flash ? "Saved" : !hasNote ? "Optional" : "\u00A0")}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {open && value.length >= NOTE_MAX_LENGTH - 40 && (
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {value.length}/{NOTE_MAX_LENGTH}
            </span>
          )}
          {editing && (
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-ink-muted transition-all duration-200 hover:border-border-strong hover:text-ink active:scale-95 disabled:opacity-40"
            >
              <X size={12} /> Cancel
            </button>
          )}
          {open && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all duration-200 active:scale-95 ${
                canSave || saving
                  ? "border-accent/50 bg-accent/15 text-accent-strong"
                  : "pointer-events-none border-transparent text-ink-faint opacity-60"
              }`}
            >
              {!saving && <Check size={12} />}
              {saving ? "Saving\u2026" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
