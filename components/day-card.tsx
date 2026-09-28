"use client";

import type { DayEntry } from "@/lib/types";
import { DAY_LABELS } from "@/lib/types";

export function DayCard({
  day,
  isUnlocked,
  onToggleTask,
}: {
  day: DayEntry;
  isUnlocked: boolean;
  onToggleTask: (taskId: string) => void;
}) {
  const doneCount = day.tasks.filter((t) => t.completed).length;
  const total = day.tasks.length;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl2 border transition-opacity ${
        isUnlocked
          ? "border-accent/40 bg-surface shadow-glow"
          : "border-border bg-surface opacity-55"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2.5 ${
          isUnlocked ? "bg-accent/10" : "bg-surface-2"
        }`}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
          {DAY_LABELS[day.dayIndex]}
        </span>
        {isUnlocked ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
            today
          </span>
        ) : (
          <LockIcon />
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1.5 px-4 py-3">
        {day.tasks.length === 0 && (
          <li className="py-2 text-center font-mono text-xs text-ink-faint">
            No tasks set for this day
          </li>
        )}
        {day.tasks.map((task) => (
          <li key={task.id}>
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 ${
                !isUnlocked ? "cursor-not-allowed" : "hover:bg-surface-2"
              }`}
            >
              <input
                type="checkbox"
                checked={task.completed}
                disabled={!isUnlocked}
                onChange={() => isUnlocked && onToggleTask(task.id)}
                className="h-4 w-4 shrink-0 accent-[#7c9468] disabled:opacity-50"
              />
              <span
                className={`text-sm ${
                  task.completed ? "text-ink-muted line-through" : "text-ink"
                }`}
              >
                {task.emoji ? `${task.emoji} ` : ""}
                {task.name}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-4 py-2.5 font-mono text-[11px] text-ink-muted">
        {total === 0 ? (
          <span>&nbsp;</span>
        ) : doneCount === 0 ? (
          <span>Let&apos;s start {"\u{1F680}"}</span>
        ) : doneCount === total ? (
          <span className="text-accent">All {total} done {"\u2705"}</span>
        ) : (
          <span>
            Done: {doneCount}/{total} goals {"\u2705"} keep going!
          </span>
        )}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
