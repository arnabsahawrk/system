import { DayRing } from "./day-ring";
import { getProgressColor, getProgressMessage, getProgressTint } from "@/lib/theme";
import type { HistoryStats, WeekSummary } from "@/lib/types";

// Sampled across the same red->green scale every row uses, so the legend
// is a literal key to the table's own colors rather than a separate scale.
const LEGEND_STOPS = [0, 17, 33, 50, 67, 83, 100];

/** "Records": one row per finalized week, newest first, plus the current
 * (still-running) week pinned at the top. The footer row's averages are
 * computed server-side over *every* finalized week (see lib/weeks.ts
 * getHistoryPage), not just whatever page happens to be loaded — so they
 * stay meaningful as more weeks load in. The Message column's footer is a
 * small heatmap-style legend instead of another average, since "message"
 * has no number to average. */
export function TrackerTable({
  weeks,
  stats,
}: {
  weeks: WeekSummary[];
  stats: HistoryStats;
}) {
  const newestFirst = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber);

  return (
    <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="sticky top-0 z-10 bg-surface py-2 pr-3 font-normal">Week</th>
            <th className="sticky top-0 z-10 bg-surface py-2 pr-3 font-normal">Task</th>
            <th className="sticky top-0 z-10 bg-surface py-2 pr-3 font-normal">Done</th>
            <th className="sticky top-0 z-10 bg-surface py-2 pr-3 font-normal">Progress</th>
            <th className="sticky top-0 z-10 bg-surface py-2 font-normal">Message</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((week) => (
            <tr
              key={week.weekNumber}
              style={{ backgroundColor: getProgressTint(week.percent) }}
              className="border-b border-border/60"
            >
              <td className="py-2.5 pr-3 text-ink">
                Week {week.weekNumber}
                {!week.finalized && <span className="ml-1.5 text-[10px] text-accent">live</span>}
              </td>
              <td className="py-2.5 pr-3 text-ink-muted">{week.total}</td>
              <td className="py-2.5 pr-3 text-ink-muted">{week.completed}</td>
              <td className="py-2.5 pr-3">
                <span className="inline-flex items-center gap-2 text-ink">
                  {week.percent}%
                  <DayRing percent={week.percent} size={18} strokeWidth={2.5} />
                </span>
              </td>
              <td className="py-2.5 text-ink-muted">{getProgressMessage(week.percent)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border-strong text-[11px] text-ink-faint">
            <td className="py-2 pr-3">{stats.weekCount} weeks</td>
            <td className="py-2 pr-3">avg {stats.avgTotal}</td>
            <td className="py-2 pr-3">avg {stats.avgCompleted}</td>
            <td className="py-2 pr-3">avg {stats.avgPercent}%</td>
            <td className="py-2">
              <div className="flex items-center gap-1">
                <span className="mr-0.5">Less</span>
                {LEGEND_STOPS.map((p) => (
                  <span
                    key={p}
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ backgroundColor: getProgressColor(p) }}
                  />
                ))}
                <span className="ml-0.5">More</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
