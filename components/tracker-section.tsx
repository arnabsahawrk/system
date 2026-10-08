"use client";

import { RecordsList } from "./records-list";
import type { CurrentWeek, DayStat, HistoryStats, WeekSummary } from "@/lib/types";

/** No tabs — this used to switch between a table and a chart, but the
 * chart's been removed entirely by request. Styled the same plain way as
 * the Everyday/Weekly headings rather than as its own card. */
export function TrackerSection({
  history,
  stats,
  hasMore,
  onLoadMore,
  loadingMore,
  currentWeek,
  todayIndex,
  onNoteSaved,
}: {
  history: WeekSummary[];
  stats: HistoryStats;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  currentWeek: CurrentWeek | null;
  todayIndex: number | null;
  onNoteSaved: (weekNumber: number, note: string | null) => void;
}) {
  // The live week's strip comes from its own day cards, so it is always
  // exactly what the cards above show — no second source to drift.
  const live: WeekSummary | null = currentWeek
    ? {
        ...currentWeek,
        finalized: false,
        dayStats: currentWeek.days.map<DayStat>((d) => ({
          done: d.tasks.filter((t) => t.completed).length,
          total: d.tasks.length,
        })),
      }
    : null;
  const allWeeks: WeekSummary[] = live ? [live, ...history] : history;

  return (
    <div>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Records</h2>
      <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-4 shadow-card sm:p-5">
        <RecordsList weeks={allWeeks} stats={stats} todayIndex={todayIndex} onNoteSaved={onNoteSaved} />
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="self-center rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? "Loading\u2026" : "Load more \u2193"}
          </button>
        )}
      </div>
    </div>
  );
}
