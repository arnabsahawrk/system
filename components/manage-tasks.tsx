"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { isTabUnlocked } from "@/lib/tab-lock";
import { DAY_LABELS } from "@/lib/types";
import type { DayIndex, TaskTemplateItem } from "@/lib/types";
import { BrandMark } from "./brand-mark";

const DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

export function ManageTasks({ hasPasscode }: { hasPasscode: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<TaskTemplateItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyDay, setBusyDay] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard nav is intentional for this security boundary, see components/dashboard.tsx
    if (hasPasscode && !isTabUnlocked()) window.location.href = "/unlock";
  }, [hasPasscode]);

  async function load() {
    const res = await fetch("/api/tasks");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard nav is intentional for this security boundary, see components/dashboard.tsx
    if (res.status === 401) return void (window.location.href = "/unlock");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
    // load is stable across renders (it doesn't close over any props/state
    // that changes), so this really does only need to run once on mount.
  }, []);

  async function addTask(dayIndex: DayIndex) {
    const name = (drafts[dayIndex] ?? "").trim();
    if (!name) return;
    setBusyDay(dayIndex);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex, name }),
      });
      if (res.ok) {
        setDrafts((d) => ({ ...d, [dayIndex]: "" }));
        await load();
      }
    } finally {
      setBusyDay(null);
    }
  }

  async function removeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  }

  async function move(dayIndex: DayIndex, index: number, direction: -1 | 1) {
    if (!items) return;
    const dayItems = items.filter((t) => t.dayIndex === dayIndex).sort((a, b) => a.sortOrder - b.sortOrder);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= dayItems.length) return;
    const reordered = [...dayItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapWith, 0, moved!);
    const orderedIds = reordered.map((t) => t.id);

    // Optimistic: re-sort locally right away, then persist.
    setItems((prev) =>
      prev
        ? prev.map((t) => {
            if (t.dayIndex !== dayIndex) return t;
            const newOrder = orderedIds.indexOf(t.id);
            return newOrder === -1 ? t : { ...t, sortOrder: newOrder };
          })
        : prev
    );
    setBusyDay(dayIndex);
    try {
      await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex, orderedIds }),
      });
    } finally {
      setBusyDay(null);
    }
  }

  if (!items) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <BrandMark size={36} className="animate-pulse-soft" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg pb-16 text-ink">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-8 sm:px-6">
        <button onClick={() => router.push("/")} className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em]">Manage tasks</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2.5 font-mono text-xs text-ink-muted">
          Changes here apply starting the next reset (Saturday 6:00 AM) — this
          week&apos;s cards stay exactly as they are.
        </p>
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 pt-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
        {DAYS.map((dayIndex) => {
          const dayItems = items
            .filter((t) => t.dayIndex === dayIndex)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={dayIndex} className="flex flex-col gap-2 rounded-xl2 border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                  {DAY_LABELS[dayIndex]}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">{dayItems.length} tasks</span>
              </div>

              <ul className="flex flex-col gap-1">
                {dayItems.length === 0 && (
                  <li className="py-1 font-mono text-xs text-ink-faint">No tasks — a rest day</li>
                )}
                {dayItems.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <div className="flex flex-col">
                      <button
                        onClick={() => move(dayIndex, i, -1)}
                        disabled={i === 0 || busyDay === dayIndex}
                        className="text-ink-faint hover:text-ink disabled:opacity-20"
                        aria-label="Move up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => move(dayIndex, i, 1)}
                        disabled={i === dayItems.length - 1 || busyDay === dayIndex}
                        className="text-ink-faint hover:text-ink disabled:opacity-20"
                        aria-label="Move down"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                    <span className="flex-1 truncate text-sm text-ink">{t.name}</span>
                    <button
                      onClick={() => removeTask(t.id)}
                      className="shrink-0 text-ink-faint hover:text-clay-strong"
                      aria-label={`Remove ${t.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTask(dayIndex);
                }}
                className="mt-1 flex items-center gap-1.5"
              >
                <input
                  value={drafts[dayIndex] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [dayIndex]: e.target.value }))}
                  placeholder="Add a task…"
                  maxLength={60}
                  className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busyDay === dayIndex || !(drafts[dayIndex] ?? "").trim()}
                  className="shrink-0 rounded-lg bg-accent p-1.5 text-[#141210] disabled:opacity-40"
                  aria-label="Add"
                >
                  <Plus size={14} />
                </button>
              </form>
            </div>
          );
        })}
      </main>
    </div>
  );
}
