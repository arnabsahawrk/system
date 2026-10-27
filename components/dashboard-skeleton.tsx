/** What the dashboard looks like while its data is still on the way: the real
 * shape of the screen as grey blocks — the same cards, the same order, the same
 * breakpoints (phone below 640px, the grid with the weekly card beside it from
 * 1024px) — so the page appears at once and fills in without anything moving.
 * Pure CSS: both layouts are in the markup and the breakpoints pick. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your week">
      {/* phones: today, weekly, the rest of the week */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 sm:hidden">
        <section>
          <Heading width="w-14" />
          <DayCardSkeleton rows={4} />
        </section>
        <section>
          <Heading width="w-16" />
          <WeeklyCardSkeleton compact />
        </section>
        <section>
          <Heading width="w-32" />
          <div className="divide-y divide-border overflow-hidden rounded-xl2 border border-border bg-surface shadow-card">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                <div className="skeleton h-[26px] w-[26px] rounded-full" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton ml-auto h-3 w-14" />
                <div className="skeleton h-4 w-4" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* wider screens: the day cards, with the weekly card beside them from lg */}
      <div className="mx-auto hidden max-w-6xl flex-col gap-6 px-4 pt-4 sm:flex sm:px-6 lg:flex-row lg:items-start">
        <section className="flex-1">
          <Heading width="w-20" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 7 }, (_, i) => (
              <DayCardSkeleton key={i} rows={i === 6 ? 2 : 4} />
            ))}
          </div>
        </section>
        <aside className="w-full lg:w-[320px] lg:shrink-0">
          <Heading width="w-16" />
          <WeeklyCardSkeleton />
        </aside>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <RecordsSkeleton />
      </div>
    </div>
  );
}

function Heading({ width }: { width: string }) {
  return <div className={`skeleton mb-3 h-3 ${width}`} />;
}

/** Same bones as DayCard: header, the 44px task rows, the footer line. */
function DayCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
      <div className="flex h-[41px] items-center justify-between bg-surface-2 px-4">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-10" />
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-[44px] items-center gap-3 px-2 py-1.5">
            <div className="skeleton h-[22px] w-[22px] shrink-0 rounded-[7px]" />
            <div className="skeleton h-3" style={{ width: `${72 - i * 11}%` }} />
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="skeleton h-3 w-28" />
      </div>
    </div>
  );
}

/** Same bones as WeeklySummaryCard: brand and title, the big percentage, the
 * bar and its line, the seven day rings. */
function WeeklyCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col rounded-xl2 border border-border bg-surface shadow-card ${
        compact ? "gap-4 p-4" : "gap-5 p-5"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="skeleton h-[26px] w-[26px] rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-2.5 w-20" />
          <div className="skeleton h-2.5 w-14" />
        </div>
      </div>
      <div className={`flex flex-col items-center gap-2 ${compact ? "py-1" : "py-4"}`}>
        <div className={`skeleton w-32 ${compact ? "h-12" : "h-14"}`} />
        <div className="skeleton h-3 w-40" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="flex min-h-[18px] items-center">
          <div className="skeleton h-3 w-48" />
        </div>
      </div>
      <div className="flex justify-between gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 px-1 py-1.5">
            <div className="skeleton h-[30px] w-[30px] rounded-full" />
            <div className="skeleton h-2 w-6" />
            <div className="skeleton h-2.5 w-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Records section: four week rows (one line each from lg, stacked below)
 * and the averages line. */
function RecordsSkeleton() {
  return (
    <div>
      <Heading width="w-16" />
      <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border px-4 py-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 lg:grid-cols-[132px_minmax(0,1fr)_72px_96px_minmax(0,190px)_20px]">
                <div className="flex flex-col gap-1.5">
                  <div className="skeleton h-3.5 w-20" />
                  <div className="skeleton h-2.5 w-24" />
                </div>
                <div className="skeleton h-4 w-14 lg:hidden" />
                <div className="col-span-2 grid grid-cols-7 gap-1 lg:col-span-1">
                  {Array.from({ length: 7 }, (_, d) => (
                    <div key={d} className="skeleton h-[18px] rounded-[5px]" />
                  ))}
                </div>
                <div className="skeleton col-span-2 h-3 w-4/5 lg:hidden" />
                <div className="skeleton hidden h-3 w-10 lg:block" />
                <div className="skeleton hidden h-3 w-14 lg:block" />
                <div className="skeleton hidden h-3 w-32 lg:block" />
                <div className="hidden lg:block" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-strong pt-3">
          <div className="skeleton h-3 w-56" />
          <div className="skeleton h-2.5 w-28" />
        </div>
      </div>
    </div>
  );
}
