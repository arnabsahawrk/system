import { BrandMark } from "./brand-mark";
import { DayRing } from "./day-ring";
import { getProgressColor, getProgressMessage } from "@/lib/theme";
import { DAY_SHORT_LABELS } from "@/lib/types";
import type { CurrentWeek } from "@/lib/types";

export function WeeklySummaryCard({
  week,
  todayIndex,
}: {
  week: CurrentWeek;
  todayIndex: number;
}) {
  const color = getProgressColor(week.percent);
  const message = getProgressMessage(week.percent);

  return (
    <div className="flex flex-col gap-5 rounded-xl2 border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
              This week
            </div>
            <div className="font-mono text-[11px] text-ink-faint">Week {week.weekNumber}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="font-mono text-5xl font-bold" style={{ color }}>
          {week.percent}%
        </div>
        <div className="text-xs text-ink-muted">
          {week.completed} of {week.total} goals completed
        </div>
        <div
          className="mt-1 rounded-full px-3 py-1 text-xs font-medium text-[#111]"
          style={{ backgroundColor: color }}
        >
          {message}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${week.percent}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex justify-between gap-1">
        {week.days.map((day, i) => {
          const done = day.tasks.filter((t) => t.completed).length;
          const pct = day.tasks.length === 0 ? 0 : (done / day.tasks.length) * 100;
          return (
            <div key={day.dayIndex} className="flex flex-col items-center gap-1">
              <div className={i === todayIndex ? "opacity-100" : "opacity-70"}>
                <DayRing percent={pct} />
              </div>
              <span className="font-mono text-[9px] uppercase text-ink-faint">
                {DAY_SHORT_LABELS[day.dayIndex]}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">{done}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
