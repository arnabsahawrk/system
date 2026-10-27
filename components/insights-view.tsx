"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Flame, RotateCw, TrendingDown, TrendingUp } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { InsightsBodySkeleton } from "./insights-skeleton";
import { PageHeader } from "./page-header";
import { goToUnlock } from "@/lib/nav";
import { isTabUnlocked } from "@/lib/tab-lock";
import { plural } from "@/lib/task-name";
import { getProgressColor } from "@/lib/theme";
import { useCountUp } from "@/lib/use-count-up";
import { DAY_LABELS, DAY_SHORT_LABELS } from "@/lib/types";
import type { Insights } from "@/lib/insights";

const CARD = "rounded-xl2 border border-border bg-surface p-5 shadow-card";
const LABEL = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted";
const CAPTION = "font-mono text-[11px] leading-snug text-ink-faint";
const TASKS_SHOWN = 6;
// Sampled across the same red-to-green scale every strip uses.
const LEGEND_STOPS = [0, 17, 33, 50, 67, 83, 100];

const number = (n: number) => n.toLocaleString("en-US");

/** Everything on this page is worked out from the task rows each time it
 * opens, over the whole history — nothing is stored, so no number can drift
 * from what actually happened. */
export function InsightsView({ hasPasscode }: { hasPasscode: boolean }) {
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (hasPasscode && !isTabUnlocked()) goToUnlock();
  }, [hasPasscode]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/insights");
      if (res.status === 401) return goToUnlock();
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Insights);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh animate-fade-in bg-bg pb-16 text-ink">
      <PageHeader title="Insights" />

      <main className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        {failed ? (
          <div className="mx-auto flex max-w-sm animate-fade-in flex-col items-center gap-3 pt-16 text-center">
            <BrandMark size={30} className="opacity-60" />
            <p className="font-mono text-xs text-ink-muted">Couldn&apos;t load your insights.</p>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
            >
              <RotateCw size={12} /> Try again
            </button>
          </div>
        ) : !data ? (
          <InsightsBodySkeleton />
        ) : !data.hasData ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal index={0}>
              <OverallCard data={data} />
            </Reveal>
            <Reveal index={1}>
              <StreaksCard data={data} />
            </Reveal>
            <Reveal index={2} className="lg:col-span-2">
              <WeeksCard data={data} />
            </Reveal>
            <Reveal index={3}>
              <DaysCard data={data} />
            </Reveal>
            <Reveal index={4}>
              <TasksCard data={data} />
            </Reveal>
            <Reveal index={5} className="lg:col-span-2">
              <ClockCard data={data} />
            </Reveal>
          </div>
        )}
      </main>
    </div>
  );
}

function Reveal({ index, className = "", children }: { index: number; className?: string; children: ReactNode }) {
  return (
    <div className={`animate-rise ${className}`} style={{ animationDelay: `${index * 70}ms` }}>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-xs animate-fade-in flex-col items-center gap-3 pt-16 text-center">
      <BrandMark size={32} className="opacity-60" />
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-ink-muted">Nothing to measure yet</h2>
      <p className="font-mono text-xs leading-relaxed text-ink-faint">
        Insights use days that have closed. Once your first day wraps up at 06:00, your numbers start building here.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
      >
        Back to today
      </Link>
    </div>
  );
}

// --------------------------------------------------------------------------

function OverallCard({ data }: { data: Insights }) {
  const o = data.overview;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Overall</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile value={o.percent} suffix="%" label="Done" color={getProgressColor(o.percent)} />
        <Tile value={o.finishedWeeks} label={o.finishedWeeks === 1 ? "Week" : "Weeks"} />
        <Tile value={o.perfectDays} label="Perfect days" />
      </div>
      <p className={`mt-4 ${CAPTION}`}>
        {number(o.done)} of {number(o.total)} tasks done on finished days. A perfect day is every task done.
      </p>
    </section>
  );
}

function Tile({ value, suffix = "", label, color }: { value: number; suffix?: string; label: string; color?: string }) {
  const shown = useCountUp(value, 800);
  return (
    <div className="flex flex-col items-center rounded-xl bg-black/20 px-1.5 py-4 text-center">
      <span className="font-mono text-3xl font-bold tabular-nums" style={{ color: color ?? "#ede6d8" }}>
        {number(shown)}
        {suffix}
      </span>
      <span className="mt-1 font-mono text-[11px] leading-tight text-ink-muted">{label}</span>
    </div>
  );
}

function StreaksCard({ data }: { data: Insights }) {
  const { perfect, active } = data.streaks;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Streaks</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StreakTile label="Perfect days" hint="every task done" current={perfect.current} best={perfect.longest} />
        <StreakTile label="Active days" hint="at least one done" current={active.current} best={active.longest} />
      </div>
      <p className={`mt-4 ${CAPTION}`}>
        Days in a row. Rest days are skipped, and today can add to a streak but never break it.
      </p>
    </section>
  );
}

function StreakTile({ label, hint, current, best }: { label: string; hint: string; current: number; best: number }) {
  const shown = useCountUp(current, 800);
  const live = current > 0;
  return (
    <div className="flex flex-col items-center rounded-xl bg-black/20 px-2 py-4 text-center">
      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-4xl font-bold tabular-nums ${live ? "text-accent-strong" : "text-ink-faint"}`}
          style={{ transition: "color 0.4s ease" }}
        >
          {shown}
        </span>
        {live && <Flame size={16} className="text-clay-strong" />}
      </div>
      <div className="mt-1 font-mono text-[11px] text-ink-muted">{label}</div>
      <div className="font-mono text-[10px] leading-tight text-ink-faint">{hint}</div>
      <div className="mt-2 font-mono text-[10px] text-ink-faint">Best: {best}</div>
    </div>
  );
}

function WeeksCard({ data }: { data: Insights }) {
  const { list, average, best, latest } = data.weeks;
  const first = list[0];
  const last = list[list.length - 1];
  const gap = latest?.vsAverage ?? null;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Weeks</h2>
      {!first || !last ? (
        <p className="mt-4 font-mono text-xs leading-relaxed text-ink-faint">
          Each finished week appears here as one square. Your first one closes on Saturday at 06:00.
        </p>
      ) : (
        <>
          <div
            className="mt-4 flex animate-fade-in flex-wrap gap-1"
            role="img"
            aria-label={`${plural(list.length, "finished week")}, oldest first`}
          >
            {list.map((w) => (
              <span
                key={w.weekNumber}
                className="h-[18px] w-[18px] rounded-[4px]"
                style={{ backgroundColor: getProgressColor(w.percent) }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 font-mono text-[10px] text-ink-faint">
            <span>
              Week {first.weekNumber}
              {first.weekNumber !== last.weekNumber && <> to {last.weekNumber}</>}
            </span>
            <span className="flex items-center gap-1">
              <span className="mr-0.5">Less</span>
              {LEGEND_STOPS.map((p) => (
                <span key={p} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: getProgressColor(p) }} />
              ))}
              <span className="ml-0.5">More</span>
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <Fact label="Average" value={average === null ? "\u2014" : `${average}%`} />
            <Fact label="Best week" value={best ? `${best.percent}%` : "\u2014"} sub={best ? `Week ${best.weekNumber}` : undefined} />
            <Fact label="Latest" value={latest ? `${latest.percent}%` : "\u2014"} sub={latest ? `Week ${latest.weekNumber}` : undefined} />
          </dl>

          {latest && gap !== null && (
            <p className="mt-4 flex items-start gap-2 font-mono text-xs leading-snug text-ink-muted">
              {gap > 0 ? (
                <TrendingUp size={15} className="mt-px shrink-0 text-accent-strong" />
              ) : gap < 0 ? (
                <TrendingDown size={15} className="mt-px shrink-0 text-clay-strong" />
              ) : (
                <ArrowRight size={15} className="mt-px shrink-0 text-ink-faint" />
              )}
              <span>
                Week {latest.weekNumber} was <span className="text-ink">{latest.percent}%</span>,{" "}
                {gap === 0
                  ? "right on your average."
                  : `${plural(Math.abs(gap), "point")} ${gap > 0 ? "above" : "below"} your average.`}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-ink">{value}</dd>
      {sub && <dd className="font-mono text-[10px] text-ink-faint">{sub}</dd>}
    </div>
  );
}

const BAR_AREA = 96;

function DaysCard({ data }: { data: Insights }) {
  const { weekdays, dayExtremes } = data;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Days of the week</h2>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {weekdays.map((w, i) => {
          const pct = w.percent;
          return (
            <div key={w.dayIndex} className="flex flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] tabular-nums text-ink-muted">{pct === null ? "\u2014" : `${pct}%`}</span>
              <div className="flex items-end" style={{ height: BAR_AREA }}>
                {pct === null ? (
                  <div className="w-7 rounded-md border border-dashed border-white/15" style={{ height: 8 }} />
                ) : (
                  <div
                    className="w-7 origin-bottom animate-bar-grow rounded-md"
                    style={{
                      height: Math.max(6, Math.round((pct / 100) * BAR_AREA)),
                      backgroundColor: getProgressColor(pct),
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                )}
              </div>
              <span className="font-mono text-[10px] uppercase text-ink-faint">{DAY_SHORT_LABELS[w.dayIndex]}</span>
            </div>
          );
        })}
      </div>
      <p className={`mt-4 ${CAPTION}`}>How much of the work you finish on each day.</p>

      {dayExtremes && (
        <dl className="mt-3 flex flex-col gap-2 border-t border-border pt-3 font-mono text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Strongest day</dt>
            <dd className="text-ink">
              {DAY_LABELS[dayExtremes.best.dayIndex]}{" "}
              <span style={{ color: getProgressColor(dayExtremes.best.percent) }}>{dayExtremes.best.percent}%</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Weakest day</dt>
            <dd className="text-ink">
              {DAY_LABELS[dayExtremes.worst.dayIndex]}{" "}
              <span style={{ color: getProgressColor(dayExtremes.worst.percent) }}>{dayExtremes.worst.percent}%</span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function TasksCard({ data }: { data: Insights }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.tasks : data.tasks.slice(0, TASKS_SHOWN);
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Tasks</h2>
      <p className={`mt-1 ${CAPTION}`}>How often you finish each one. Weakest first.</p>

      {data.tasks.length === 0 ? (
        <p className="mt-5 font-mono text-xs leading-relaxed text-ink-faint">
          A task shows up here once it has had 3 finished days.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3.5">
          {rows.map((t, i) => (
            <li key={t.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 font-mono text-xs">
                <span className="min-w-0 truncate text-ink">{t.name}</span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {t.done}/{t.total} &middot; <span style={{ color: getProgressColor(t.percent) }}>{t.percent}%</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full origin-left animate-bar-grow-x rounded-full"
                  style={{
                    width: `${t.percent}%`,
                    backgroundColor: getProgressColor(t.percent),
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.tasks.length > TASKS_SHOWN && (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-4 font-mono text-[11px] text-ink-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
        >
          {all ? "Show fewer" : `Show all ${data.tasks.length}`}
        </button>
      )}

      <Link
        href="/manage"
        className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 font-mono text-[11px] text-accent-strong transition-colors hover:text-ink"
      >
        Edit tasks <ArrowRight size={12} />
      </Link>
    </section>
  );
}

const HOUR_LABELS = ["6 AM", "12 PM", "6 PM", "12 AM"];

function ClockCard({ data }: { data: Insights }) {
  const { ticks, medianLabel, hourBuckets, tickDays, afterMidnightDays } = data.clock;
  const max = Math.max(1, ...hourBuckets);
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Time of day</h2>
      {ticks === 0 ? (
        <p className="mt-4 font-mono text-xs text-ink-faint">No ticks yet.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent-strong">
              <Clock size={18} />
            </span>
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums">{medianLabel}</div>
              <div className="font-mono text-[11px] text-ink-faint">
                typical time you tick a task &middot; {plural(ticks, "tick")}
              </div>
            </div>
          </div>

          <div
            className="mt-5 grid h-14 items-end gap-[2px]"
            style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" } as CSSProperties}
          >
            {hourBuckets.map((n, i) => (
              <div
                key={i}
                className="origin-bottom animate-bar-grow rounded-[2px]"
                style={{
                  height: n === 0 ? 2 : Math.max(4, Math.round((n / max) * 56)),
                  backgroundColor: n === 0 ? "rgba(255,255,255,0.08)" : i >= 18 ? "#c17a4e" : "#7c9468",
                  animationDelay: `${i * 18}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-4 font-mono text-[10px] text-ink-faint">
            {HOUR_LABELS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>

          {tickDays > 0 && (
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 font-mono text-xs text-ink-muted">
              <span className="h-2 w-2 shrink-0 rounded-full bg-clay" aria-hidden="true" />
              Finished after midnight on {afterMidnightDays} of {plural(tickDays, "day")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
