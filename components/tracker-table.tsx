import { DayRing } from "./day-ring";
import { getProgressMessage, getProgressTint } from "@/lib/theme";
import type { WeekSummary } from "@/lib/types";

export function TrackerTable({ weeks }: { weeks: WeekSummary[] }) {
  const newestFirst = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-2 pr-3 font-normal">Week</th>
            <th className="py-2 pr-3 font-normal">Done</th>
            <th className="py-2 pr-3 font-normal">Progress</th>
            <th className="py-2 font-normal">Message</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((week) => (
            <tr
              key={week.weekNumber}
              style={{ backgroundColor: getProgressTint(week.percent) }}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-2.5 pr-3 text-ink">Week {week.weekNumber}</td>
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
      </table>
    </div>
  );
}
