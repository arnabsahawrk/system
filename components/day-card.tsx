"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Lock } from "lucide-react";
import { TaskRow } from "./task-row";
import type { DayEntry } from "@/lib/types";
import { DAY_LABELS } from "@/lib/types";

/** Where a day sits relative to now. Only "today" can be ticked. */
export type DayStatus = "today" | "past" | "future";

export type ToggleHandler = (taskId: string, next: boolean, row: HTMLElement) => void;

/** The task list and its footer line — shared by the full card and by the
 * read-only body of an expanded day on the phone layout. */
export function DayTasks({
  day,
  status,
  onToggleTask,
}: {
  day: DayEntry;
  status: DayStatus;
  onToggleTask: ToggleHandler;
}) {
  const unlocked = status === "today";
  const total = day.tasks.length;
  const doneCount = day.tasks.filter((t) => t.completed).length;

  return (
    <>
      <ul className="flex flex-1 flex-col gap-0.5 px-2 py-2.5">
        {total === 0 && (
          <li className="py-3 text-center font-mono text-xs text-ink-faint">No tasks set for this day</li>
        )}
        {day.tasks.map((task) => (
          <li key={task.id}>
            <TaskRow
              name={task.name}
              completed={task.completed}
              locked={!unlocked}
              // The server sends the chain *before* today; today's own tick adds one.
              chain={unlocked && task.chain !== undefined ? task.chain + (task.completed ? 1 : 0) : 0}
              onToggle={(next, row) => onToggleTask(task.id, next, row)}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-4 py-2.5 font-mono text-[11px] text-ink-muted">
        <Footer status={status} done={doneCount} total={total} />
      </div>
    </>
  );
}

function Footer({ status, done, total }: { status: DayStatus; done: number; total: number }) {
  if (total === 0) return <span>{status === "today" ? "\u00A0" : "Rest day"}</span>;
  if (status === "future") return <span>{total === 1 ? "1 task ahead" : `${total} tasks ahead`}</span>;
  if (done === total) {
    return (
      <span className="inline-flex items-center gap-1.5 text-accent-strong">
        <Check size={12} strokeWidth={3} />
        All {total} done
      </span>
    );
  }
  if (status === "past") return <span>{done}/{total} done</span>;
  if (done === 0) return <span>Let&apos;s start</span>;
  return (
    <span>
      Done: {done}/{total} goals &middot; keep going
    </span>
  );
}

export function DayCard({
  day,
  status,
  onToggleTask,
  className = "",
  style,
}: {
  day: DayEntry;
  status: DayStatus;
  onToggleTask: ToggleHandler;
  className?: string;
  style?: CSSProperties;
}) {
  const isToday = status === "today";
  const total = day.tasks.length;
  const doneCount = day.tasks.filter((t) => t.completed).length;
  const complete = total > 0 && doneCount === total;

  // One-time flourish the moment today's last task is ticked: a band of light
  // sweeps across the header and the "done" badge is stamped on. It is armed
  // by the transition into "complete", never by a card that loads already done.
  const [celebrating, setCelebrating] = useState(false);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (isToday && complete && !wasComplete.current) setCelebrating(true);
    wasComplete.current = complete;
  }, [complete, isToday]);
  useEffect(() => {
    if (!celebrating) return;
    const t = window.setTimeout(() => setCelebrating(false), 1400);
    return () => window.clearTimeout(t);
  }, [celebrating]);

  return (
    <div
      style={style}
      className={`relative flex flex-col overflow-hidden rounded-xl2 border transition-[border-color,box-shadow,opacity] duration-500 ${
        isToday
          ? complete
            ? "border-accent/70 bg-surface shadow-glow-done"
            : "border-accent/40 bg-surface shadow-glow"
          : "border-border bg-surface opacity-55"
      } ${className}`}
    >
      <div
        className={`relative flex items-center justify-between overflow-hidden px-4 py-2.5 transition-colors duration-500 ${
          isToday ? (complete ? "bg-accent/20" : "bg-accent/10") : "bg-surface-2"
        }`}
      >
        {celebrating && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-2/5 animate-sweep bg-gradient-to-r from-transparent via-accent-strong/40 to-transparent"
          />
        )}
        <span className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
          {DAY_LABELS[day.dayIndex]}
        </span>
        <span className="relative">
          {isToday ? (
            complete ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-strong ${
                  celebrating ? "animate-stamp" : ""
                }`}
              >
                <Check size={11} strokeWidth={3} />
                done
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent">today</span>
            )
          ) : (
            <Lock size={12} className="text-ink-faint" />
          )}
        </span>
        {total > 0 && (
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-700 ease-spring ${
              isToday ? "bg-accent" : "bg-ink-faint/60"
            }`}
            style={{ transform: `scaleX(${doneCount / total})` }}
          />
        )}
      </div>

      <DayTasks day={day} status={status} onToggleTask={onToggleTask} />
    </div>
  );
}
