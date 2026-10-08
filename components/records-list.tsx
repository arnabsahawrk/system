"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Quote, RotateCw } from "lucide-react";
import { Collapse } from "./collapse";
import { DayRing } from "./day-ring";
import { WeekStrip } from "./week-strip";
import { NOTE_MAX_LENGTH } from "@/lib/goals";
import { goToUnlock } from "@/lib/nav";
import { getProgressColor, getProgressMessage, getProgressTint } from "@/lib/theme";
import { DAY_SHORT_LABELS } from "@/lib/types";
import type { DayIndex, HistoryStats, WeekDetail, WeekSummary } from "@/lib/types";
import { parseDateKey, addDaysToDateKey } from "@/lib/date";

// Sampled across the same red->green scale every row uses, so the legend
// is a literal key to the strips' own colors rather than a separate scale.
const LEGEND_STOPS = [0, 17, 33, 50, 67, 83, 100];

/** "Sep 26 – Oct 2" for the week that started on `startDateKey`. */
function formatWeekRange(startDateKey: string): string {
  const fmt = (key: string) => {
    const { year, month, day } = parseDateKey(key);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
  };
  return `${fmt(startDateKey)} \u2013 ${fmt(addDaysToDateKey(startDateKey, 6))}`;
}

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: WeekDetail };

/** The week grid shared by the header labels and every row, so day letters
 * line up with the cells beneath them. Stacked on phones, one line from lg. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 lg:grid-cols-[132px_minmax(0,1fr)_72px_96px_minmax(0,190px)_20px]";

/** "Records": one row per week, newest first, with the live week pinned at
 * the top. Each row is a seven-cell strip (the week's heatmap); tapping a
 * finished week opens a post-mortem of what was missed plus an optional
 * one-line note. The footer's averages are computed server-side over *every*
 * finalized week (lib/weeks.ts getHistoryPage), not just the loaded page. */
export function RecordsList({
  weeks,
  stats,
  todayIndex,
  onNoteSaved,
}: {
  weeks: WeekSummary[];
  stats: HistoryStats;
  todayIndex: number | null;
  onNoteSaved: (weekNumber: number, note: string | null) => void;
}) {
  const newestFirst = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetailState>>({});

  const loadDetail = useCallback(async (weekNumber: number) => {
    setDetails((d) => ({ ...d, [weekNumber]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/week/${weekNumber}`);
      if (res.status === 401) {
        goToUnlock();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as WeekDetail;
      setDetails((d) => ({ ...d, [weekNumber]: { status: "ready", data } }));
    } catch {
      setDetails((d) => ({ ...d, [weekNumber]: { status: "error" } }));
    }
  }, []);

  function toggle(weekNumber: number) {
    if (openWeek === weekNumber) {
      setOpenWeek(null);
      return;
    }
    setOpenWeek(weekNumber);
    if (!details[weekNumber] || details[weekNumber]!.status === "error") void loadDetail(weekNumber);
  }

  function handleNoteSaved(weekNumber: number, note: string | null) {
    setDetails((d) => {
      const cur = d[weekNumber];
      return cur?.status === "ready" ? { ...d, [weekNumber]: { status: "ready", data: { ...cur.data, note } } } : d;
    });
    onNoteSaved(weekNumber, note);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Column captions — wide screens only; on phones each row explains itself. */}
      <div className={`${ROW_GRID} hidden px-4 font-mono text-[10px] uppercase tracking-wider text-ink-faint lg:grid`}>
        <span>Week</span>
        <span className="grid grid-cols-7 gap-1 text-center">
          {([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((i) => (
            <span key={i}>{DAY_SHORT_LABELS[i]}</span>
          ))}
        </span>
        <span>Done</span>
        <span>Progress</span>
        <span>Message</span>
        <span />
      </div>

      <div className="flex flex-col gap-2">
        {newestFirst.map((week, idx) => (
          <RecordRow
            key={week.weekNumber}
            week={week}
            index={idx}
            todayIndex={week.finalized ? null : todayIndex}
            open={openWeek === week.weekNumber}
            detail={details[week.weekNumber]}
            onToggle={() => toggle(week.weekNumber)}
            onRetry={() => void loadDetail(week.weekNumber)}
            onNoteSaved={handleNoteSaved}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-strong pt-3 font-mono text-[11px] text-ink-faint">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>{stats.weekCount} weeks</span>
          <span>avg {stats.avgTotal} tasks</span>
          <span>avg {stats.avgCompleted} done</span>
          <span>avg {stats.avgPercent}%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="mr-0.5">Less</span>
          {LEGEND_STOPS.map((p) => (
            <span key={p} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: getProgressColor(p) }} />
          ))}
          <span className="ml-0.5">More</span>
        </span>
      </div>
    </div>
  );
}

function RecordRow({
  week,
  index,
  todayIndex,
  open,
  detail,
  onToggle,
  onRetry,
  onNoteSaved,
}: {
  week: WeekSummary;
  index: number;
  todayIndex: number | null;
  open: boolean;
  detail: DetailState | undefined;
  onToggle: () => void;
  onRetry: () => void;
  onNoteSaved: (weekNumber: number, note: string | null) => void;
}) {
  const live = !week.finalized;
  const message = live ? "In progress" : getProgressMessage(week.percent);
  const dayStats = week.dayStats ?? [];
  // Mounted on first open so a long history doesn't build hundreds of hidden panels.
  const [everOpened, setEverOpened] = useState(false);
  if (open && !everOpened) setEverOpened(true);

  const summary = (
    <>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-mono text-sm text-ink">
          Week {week.weekNumber}
          {live && (
            <span className="rounded-full bg-accent/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-accent">
              live
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-ink-faint">{formatWeekRange(week.startDateKey)}</div>
      </div>

      <div className="flex items-center justify-end gap-2 lg:hidden">
        <span className="font-mono text-sm tabular-nums text-ink">{week.percent}%</span>
        <DayRing percent={week.percent} size={22} strokeWidth={3} />
      </div>

      <div className="col-span-2 lg:col-span-1">
        <WeekStrip dayStats={dayStats} todayIndex={todayIndex} height={18} />
      </div>

      {/* phones: one summary line */}
      <div className="col-span-2 flex items-center justify-between gap-3 font-mono text-[11px] text-ink-muted lg:hidden">
        <span className="truncate">
          {week.completed} of {week.total} goals &middot; {message}
        </span>
        {!live && (
          <ChevronDown
            size={16}
            className={`shrink-0 text-ink-faint transition-transform duration-300 ease-spring ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {/* wide screens: separate columns */}
      <span className="hidden font-mono text-sm text-ink-muted lg:block">
        {week.completed}/{week.total}
      </span>
      <span className="hidden items-center gap-2 font-mono text-sm text-ink lg:inline-flex">
        <span className="tabular-nums">{week.percent}%</span>
        <DayRing percent={week.percent} size={18} strokeWidth={2.5} />
      </span>
      <span className="hidden truncate font-mono text-xs text-ink-muted lg:block">{message}</span>
      <span className="hidden justify-end lg:flex">
        {!live && (
          <ChevronDown
            size={16}
            className={`text-ink-faint transition-transform duration-300 ease-spring ${open ? "rotate-180" : ""}`}
          />
        )}
      </span>

      {week.note && (
        <p className="col-span-2 flex items-start gap-1.5 font-mono text-[11px] leading-snug text-ink-muted lg:col-span-6">
          <Quote size={11} className="mt-0.5 shrink-0 text-ink-faint" />
          <span className="min-w-0 break-words italic">{week.note}</span>
        </p>
      )}
    </>
  );

  return (
    <div
      className="animate-rise overflow-hidden rounded-xl border border-border transition-colors duration-300"
      style={{ backgroundColor: getProgressTint(week.percent), animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      {live ? (
        <div className={`${ROW_GRID} px-4 py-3`}>{summary}</div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`${ROW_GRID} w-full px-4 py-3 text-left transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05]`}
        >
          {summary}
        </button>
      )}

      {!live && (
        <Collapse open={open}>
          {everOpened && (
            <div className="border-t border-border bg-black/10 px-4 pb-3 pt-4">
              <DetailPanel week={week} detail={detail} onRetry={onRetry} onNoteSaved={onNoteSaved} />
            </div>
          )}
        </Collapse>
      )}
    </div>
  );
}

function DetailPanel({
  week,
  detail,
  onRetry,
  onNoteSaved,
}: {
  week: WeekSummary;
  detail: DetailState | undefined;
  onRetry: () => void;
  onNoteSaved: (weekNumber: number, note: string | null) => void;
}) {
  if (!detail || detail.status === "loading") {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-5 w-3/5" />
      </div>
    );
  }
  if (detail.status === "error") {
    return (
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-clay-strong">
        <span>Couldn&apos;t load this week.</span>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
        >
          <RotateCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const data = detail.data;
  const missed = data.days
    .map((d) => ({ dayIndex: d.dayIndex, names: d.tasks.filter((t) => !t.completed).map((t) => t.name) }))
    .filter((d) => d.names.length > 0);
  const missedCount = missed.reduce((n, d) => n + d.names.length, 0);

  return (
    <div className="flex animate-fade-in flex-col gap-4">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {data.total === 0 ? "No tasks" : missedCount === 0 ? "Nothing missed" : `Missed \u00B7 ${missedCount}`}
        </div>
        {data.total > 0 && missedCount === 0 && (
          <p className="inline-flex items-center gap-1.5 font-mono text-xs text-accent-strong">
            <Check size={13} strokeWidth={3} /> Every task was done.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {missed.map((d) => (
            <div key={d.dayIndex} className="flex gap-3">
              <span className="w-8 shrink-0 pt-1 font-mono text-[10px] uppercase text-ink-faint">
                {DAY_SHORT_LABELS[d.dayIndex]}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {d.names.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="rounded-md border border-clay/25 bg-clay/10 px-2 py-0.5 font-mono text-xs text-clay-strong"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <NoteEditor weekNumber={week.weekNumber} saved={data.note ?? ""} onSaved={onNoteSaved} />
    </div>
  );
}

/** The optional "what got in the way?" line. Saving only ever writes the
 * note — the week's tasks are frozen and never touched from here. */
export function NoteEditor({
  weekNumber,
  saved,
  onSaved,
  autoFocus = false,
}: {
  weekNumber: number;
  saved: string;
  onSaved: (weekNumber: number, note: string | null) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  // Guards against a second save starting while one is on the wire (a blur
  // and a tap on Save can arrive back to back).
  const inFlight = useRef(false);
  const normalized = value.replace(/\s+/g, " ").trim();
  const dirty = normalized !== saved;

  async function save() {
    if (!dirty || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setState("idle");
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
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { note: string | null };
      setValue(json.note ?? "");
      onSaved(weekNumber, json.note);
      setState("saved");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={`note-${weekNumber}`}
        className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
      >
        What got in the way?
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`note-${weekNumber}`}
          type="text"
          value={value}
          maxLength={NOTE_MAX_LENGTH}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
          // Leaving the field saves what's there, so a note typed and then
          // abandoned by tapping elsewhere is never silently lost.
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="Optional, one line"
          className="min-w-0 flex-1 rounded-lg border border-border bg-black/20 px-3 py-2 font-mono text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent/60"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className={`shrink-0 rounded-lg border px-3 py-2 font-mono text-xs transition-all duration-200 active:scale-95 ${
            dirty
              ? "border-accent/50 bg-accent/15 text-accent-strong"
              : "pointer-events-none border-transparent text-ink-faint opacity-60"
          }`}
        >
          {saving ? "Saving\u2026" : state === "saved" ? "Saved" : normalized === "" && saved !== "" ? "Clear" : "Save"}
        </button>
      </div>
      <div className="mt-1.5 flex min-h-[16px] items-center justify-between font-mono text-[10px]">
        <span className={state === "error" ? "text-clay-strong" : "text-transparent"}>
          Couldn&apos;t save — try again.
        </span>
        {value.length >= NOTE_MAX_LENGTH - 40 && (
          <span className="text-ink-faint">
            {value.length}/{NOTE_MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
