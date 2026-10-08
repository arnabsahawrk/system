"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Flame, ListChecks, RotateCw, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { goToUnlock } from "@/lib/nav";
import { TARGET_PERCENT, TASK_WINDOW_WEEKS } from "@/lib/goals";
import { getProgressColor } from "@/lib/theme";
import { isTabUnlocked } from "@/lib/tab-lock";
import { useCountUp } from "@/lib/use-count-up";
import { DAY_SHORT_LABELS } from "@/lib/types";
import type { Insights } from "@/lib/insights";

const CARD = "rounded-xl2 border border-border bg-surface p-5 shadow-card";
const LABEL = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted";
const TASKS_SHOWN = 6;

/** Every figure here is recomputed from the task rows each time the page
 * opens — streaks, bests, weekday shape, task consistency, tick clock — so
 * there is no stored number that can drift from what actually happened. */
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
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-8 sm:px-6">
        <Link
          href="/"
          aria-label="Back"
          className="rounded-lg p-2 text-ink-muted transition-all duration-200 hover:bg-surface-2 hover:text-ink active:scale-90"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em]">Insights</h1>
      </header>

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
          <Skeleton />
        ) : !data.hasData ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal index={0} className="lg:col-span-2">
              <StreaksCard data={data} />
            </Reveal>
            <Reveal index={1}>
              <BestsCard data={data} />
            </Reveal>
            <Reveal index={2}>
              <ShapeCard data={data} />
            </Reveal>
            <Reveal index={3}>
              <TasksCard data={data} />
            </Reveal>
            <Reveal index={4}>
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

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading insights">
      <div className={`${CARD} lg:col-span-2`}>
        <div className="skeleton h-3 w-20" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={CARD}>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-5 h-28" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-xs animate-fade-in flex-col items-center gap-3 pt-16 text-center">
      <BrandMark size={32} className="opacity-60" />
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-ink-muted">Nothing to measure yet</h2>
      <p className="font-mono text-xs leading-relaxed text-ink-faint">
        Insights are worked out from days that have closed. Once your first day wraps up (at 06:00), streaks, bests
        and patterns start to build here.
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

function StreaksCard({ data }: { data: Insights }) {
  const { perfectDays, strongDays, weeks } = data.streaks;
  return (
    <section className={CARD}>
      <h2 className={LABEL}>Streaks</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Perfect days" current={perfectDays.current} best={perfectDays.longest} />
        <StatTile label={`Days ${TARGET_PERCENT}%+`} current={strongDays.current} best={strongDays.longest} />
        <StatTile label={`Weeks ${TARGET_PERCENT}%+`} current={weeks.current} best={weeks.longest} />
      </div>
      <p className="mt-4 font-mono text-[11px] leading-snug text-ink-faint">
        Rest days are skipped, and today only counts once it&apos;s finished — an unfinished day never breaks a streak.
      </p>
    </section>
  );
}

function StatTile({ label, current, best }: { label: string; current: number; best: number }) {
  const shown = useCountUp(current, 800);
  const live = current > 0;
  return (
    <div className="flex flex-col items-center rounded-xl bg-black/20 px-1.5 py-4 text-center">
      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-4xl font-bold tabular-nums ${live ? "text-accent-strong" : "text-ink-faint"}`}
          style={{ transition: "color 0.4s ease" }}
        >
          {shown}
        </span>
        {live && <Flame size={16} className="text-clay-strong" />}
      </div>
      <div className="mt-1 font-mono text-[10px] leading-tight text-ink-muted sm:text-[11px]">{label}</div>
      <div className="mt-0.5 font-mono text-[10px] text-ink-faint">best {best}</div>
    </div>
  );
}

function BestsCard({ data }: { data: Insights }) {
  const { bestWeek, mostTasks, biggestJump, perfectDays } = data.bests;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Personal bests</h2>
      <ul className="mt-4 flex flex-col gap-3.5">
        <BestRow
          icon={<Trophy size={15} />}
          label="Best week"
          value={bestWeek ? `${bestWeek.percent}%` : null}
          sub={bestWeek ? `Week ${bestWeek.weekNumber} \u00B7 ${bestWeek.done}/${bestWeek.total}` : "after your first finished week"}
        />
        <BestRow
          icon={<ListChecks size={15} />}
          label="Most tasks in a week"
          value={mostTasks ? String(mostTasks.done) : null}
          sub={mostTasks ? `Week ${mostTasks.weekNumber}` : "after your first finished week"}
        />
        <BestRow
          icon={<TrendingUp size={15} />}
          label="Biggest jump"
          value={biggestJump ? `+${biggestJump.delta}` : null}
          sub={
            biggestJump
              ? `Week ${biggestJump.fromWeekNumber} \u2192 ${biggestJump.weekNumber}`
              : "needs two finished weeks in a row"
          }
        />
        <BestRow
          icon={<Sparkles size={15} />}
          label="Perfect days"
          value={String(perfectDays)}
          sub="every task done, all time"
        />
      </ul>
    </section>
  );
}

function BestRow({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string | null; sub: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-strong">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs text-ink">{label}</div>
        <div className="truncate font-mono text-[11px] text-ink-faint">{sub}</div>
      </div>
      <div className={`font-mono text-xl font-bold tabular-nums ${value ? "text-ink" : "text-ink-faint"}`}>
        {value ?? "\u2014"}
      </div>
    </li>
  );
}

const BAR_AREA = 96;

function ShapeCard({ data }: { data: Insights }) {
  const { weekdays, sampleWeeks, trend } = data.shape;
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Your week&apos;s shape</h2>
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
              <span className="font-mono text-[9px] text-ink-faint">{w.days === 0 ? "" : `${w.days}d`}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-snug text-ink-faint">
        Based on closed days across {sampleWeeks} {sampleWeeks === 1 ? "week" : "weeks"}
        {sampleWeeks < 4 ? " \u2014 early numbers, they firm up after about 4 weeks." : "."}
      </p>

      <div className="mt-3 border-t border-border pt-3">
        {trend ? (
          <p className="flex items-start gap-2 font-mono text-xs leading-snug text-ink-muted">
            {trend.delta > 0 ? (
              <TrendingUp size={15} className="mt-px shrink-0 text-accent-strong" />
            ) : trend.delta < 0 ? (
              <TrendingDown size={15} className="mt-px shrink-0 text-clay-strong" />
            ) : (
              <ArrowRight size={15} className="mt-px shrink-0 text-ink-faint" />
            )}
            <span>
              The last {trend.weeks === 1 ? "week" : `${trend.weeks} weeks`} averaged{" "}
              <span className="text-ink">{trend.recent}%</span>
              {trend.delta === 0
                ? `, level with the ${trend.weeks === 1 ? "week" : `${trend.weeks} weeks`} before.`
                : `, ${trend.delta > 0 ? "up" : "down"} ${Math.abs(trend.delta)} ${
                    Math.abs(trend.delta) === 1 ? "point" : "points"
                  } on the ${trend.weeks === 1 ? "week" : `${trend.weeks} weeks`} before.`}
            </span>
          </p>
        ) : (
          <p className="font-mono text-xs text-ink-faint">The trend appears after two finished weeks.</p>
        )}
      </div>
    </section>
  );
}

function TasksCard({ data }: { data: Insights }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.tasks : data.tasks.slice(0, TASKS_SHOWN);
  return (
    <section className={`${CARD} h-full`}>
      <h2 className={LABEL}>Task consistency</h2>
      <p className="mt-1 font-mono text-[11px] text-ink-faint">
        Last {TASK_WINDOW_WEEKS} weeks, closed days only &middot; weakest first
      </p>

      {data.tasks.length === 0 ? (
        <p className="mt-5 font-mono text-xs leading-relaxed text-ink-faint">
          A task is ranked once it has shown up on at least 3 closed days. Check back in a few days.
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
        Reshape tasks in Manage Tasks <ArrowRight size={12} />
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
      <h2 className={LABEL}>When you tick</h2>
      {ticks === 0 ? (
        <p className="mt-5 font-mono text-xs text-ink-faint">No ticks recorded in the last {TASK_WINDOW_WEEKS} weeks.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent-strong">
              <Clock size={18} />
            </span>
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums">{medianLabel}</div>
              <div className="font-mono text-[11px] text-ink-faint">typical tick time &middot; {ticks} ticks</div>
            </div>
          </div>

          <div className="mt-5 grid h-14 items-end gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" } as CSSProperties}>
            {hourBuckets.map((n, i) => (
              <div
                key={i}
                title={`${n} ${n === 1 ? "tick" : "ticks"}`}
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
            <p className="mt-4 border-t border-border pt-3 font-mono text-xs leading-snug text-ink-muted">
              <span className="text-clay-strong">Closed after midnight:</span> {afterMidnightDays} of {tickDays}{" "}
              {tickDays === 1 ? "day" : "days"}
              <span className="block text-[11px] text-ink-faint">the last tick landed in the 06:00 grace window</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
