"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapse } from "./collapse";
import { DayCard, DayTasks } from "./day-card";
import type { DayStatus, ToggleHandler } from "./day-card";
import { DayRing } from "./day-ring";
import { WeeklySummaryCard } from "./weekly-summary-card";
import { useMediaQuery } from "@/lib/use-media-query";
import { DAY_LABELS } from "@/lib/types";
import type { CurrentWeek, DayEntry } from "@/lib/types";

const HEADING = "mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted";

function statusOf(dayIndex: number, todayIndex: number): DayStatus {
  return dayIndex === todayIndex ? "today" : dayIndex < todayIndex ? "past" : "future";
}

/** The seven days and the weekly summary. Two layouts, one tree of state:
 * a wide grid (every day at once, summary alongside) and a phone layout that
 * puts today first — the only card you can touch — instead of making you
 * scroll past up to six locked ones to reach it. */
export function WeekView({
  week,
  todayIndex,
  onToggleTask,
}: {
  week: CurrentWeek;
  todayIndex: number;
  onToggleTask: ToggleHandler;
}) {
  const isPhone = useMediaQuery("(max-width: 639px)");
  return isPhone ? (
    <PhoneWeek week={week} todayIndex={todayIndex} onToggleTask={onToggleTask} />
  ) : (
    <GridWeek week={week} todayIndex={todayIndex} onToggleTask={onToggleTask} />
  );
}

function GridWeek({
  week,
  todayIndex,
  onToggleTask,
}: {
  week: CurrentWeek;
  todayIndex: number;
  onToggleTask: ToggleHandler;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:flex-row lg:items-start">
      <section className="flex-1">
        <h2 className={HEADING}>Everyday</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {week.days.map((day, i) => (
            <DayCard
              key={day.dayIndex}
              day={day}
              status={statusOf(i, todayIndex)}
              onToggleTask={onToggleTask}
              className="animate-rise"
              style={{ animationDelay: `${i * 55}ms` }}
            />
          ))}
        </div>
      </section>

      <aside className="w-full lg:w-[320px] lg:shrink-0">
        <h2 className={HEADING}>Weekly</h2>
        <div className="animate-rise" style={{ animationDelay: "120ms" }}>
          <WeeklySummaryCard week={week} todayIndex={todayIndex} />
        </div>
      </aside>
    </main>
  );
}

function PhoneWeek({
  week,
  todayIndex,
  onToggleTask,
}: {
  week: CurrentWeek;
  todayIndex: number;
  onToggleTask: ToggleHandler;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const today = week.days[todayIndex];

  function selectDay(i: number) {
    if (i === todayIndex) {
      setExpanded(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setExpanded((cur) => (cur === i ? null : i));
    requestAnimationFrame(() => {
      document.getElementById(`day-row-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4">
      {today && (
        <section>
          <h2 className={HEADING}>Today</h2>
          <DayCard day={today} status="today" onToggleTask={onToggleTask} className="animate-rise" />
        </section>
      )}

      <section>
        <h2 className={HEADING}>Weekly</h2>
        <div className="animate-rise" style={{ animationDelay: "90ms" }}>
          <WeeklySummaryCard
            week={week}
            todayIndex={todayIndex}
            compact
            selectedDay={expanded}
            onSelectDay={selectDay}
          />
        </div>
      </section>

      <section>
        <h2 className={HEADING}>Rest of the week</h2>
        <div
          className="animate-rise divide-y divide-border overflow-hidden rounded-xl2 border border-border bg-surface shadow-card"
          style={{ animationDelay: "180ms" }}
        >
          {week.days
            .filter((d) => d.dayIndex !== todayIndex)
            .map((day) => (
              <DayRow
                key={day.dayIndex}
                day={day}
                status={statusOf(day.dayIndex, todayIndex)}
                open={expanded === day.dayIndex}
                onToggle={() => setExpanded((cur) => (cur === day.dayIndex ? null : day.dayIndex))}
                onToggleTask={onToggleTask}
              />
            ))}
        </div>
      </section>
    </main>
  );
}

/** One line per other day, opening read-only on tap. */
function DayRow({
  day,
  status,
  open,
  onToggle,
  onToggleTask,
}: {
  day: DayEntry;
  status: DayStatus;
  open: boolean;
  onToggle: () => void;
  onToggleTask: ToggleHandler;
}) {
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.completed).length;
  const summary =
    total === 0 ? "Rest day" : status === "future" ? `${total} ${total === 1 ? "task" : "tasks"}` : `${done}/${total} done`;

  return (
    <div id={`day-row-${day.dayIndex}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05]"
      >
        <span className={status === "past" ? "opacity-80" : "opacity-60"}>
          <DayRing percent={total === 0 ? 0 : (done / total) * 100} size={26} strokeWidth={3} />
        </span>
        <span
          className={`font-mono text-xs uppercase tracking-[0.18em] ${
            status === "past" ? "text-ink-muted" : "text-ink-faint"
          }`}
        >
          {DAY_LABELS[day.dayIndex]}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-faint">{summary}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-faint transition-transform duration-300 ease-spring ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Collapse open={open}>
        <div className="border-t border-border bg-black/10">
          <DayTasks day={day} status={status} onToggleTask={onToggleTask} />
        </div>
      </Collapse>
    </div>
  );
}
