import { TrackerTable } from "./tracker-table";
import type { CurrentWeek, HistoryStats, WeekSummary } from "@/lib/types";

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
}: {
  history: WeekSummary[];
  stats: HistoryStats;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  currentWeek: CurrentWeek | null;
}) {
  const allWeeks: WeekSummary[] = currentWeek
    ? [{ ...currentWeek, finalized: false }, ...history]
    : history;

  return (
    <div>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Records</h2>
      <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-5 shadow-card">
        <TrackerTable weeks={allWeeks} stats={stats} />
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="self-center rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more ↓"}
          </button>
        )}
      </div>
    </div>
  );
}
