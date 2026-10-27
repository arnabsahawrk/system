import { PageHeader } from "./page-header";

const CARD = "rounded-xl2 border border-border bg-surface p-5 shadow-card";

/** Header plus the grey-block body — the route's loading screen
 * (app/insights/loading.tsx). */
export function InsightsSkeleton() {
  return (
    <div className="min-h-dvh animate-fade-in bg-bg pb-16 text-ink">
      <PageHeader title="Insights" />
      <main className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <InsightsBodySkeleton />
      </main>
    </div>
  );
}

/** The cards of the Insights page in the same grid as the real thing:
 * overall and streaks, every week, days and tasks, time of day. */
export function InsightsBodySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading insights">
      <div className={CARD}>
        <div className="skeleton h-3 w-16" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-3 w-4/5" />
      </div>

      <div className={CARD}>
        <div className="skeleton h-3 w-16" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-3 w-3/5" />
      </div>

      <div className={`${CARD} lg:col-span-2`}>
        <div className="skeleton h-3 w-14" />
        <div className="mt-4 flex flex-wrap gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} className="skeleton h-[18px] w-[18px] rounded-[4px]" />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="skeleton h-2.5 w-14" />
              <div className="skeleton h-6 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className="skeleton h-3 w-24" />
        <div className="mt-5 grid grid-cols-7 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="skeleton h-2.5 w-6" />
              <div className="skeleton w-7" style={{ height: 40 + ((i * 23) % 56) }} />
              <div className="skeleton h-2.5 w-6" />
            </div>
          ))}
        </div>
        <div className="skeleton mt-5 h-3 w-3/4" />
      </div>

      <div className={CARD}>
        <div className="skeleton h-3 w-14" />
        <div className="mt-4 flex flex-col gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="mb-1.5 flex justify-between">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-3 w-14" />
              </div>
              <div className="skeleton h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className={`${CARD} lg:col-span-2`}>
        <div className="skeleton h-3 w-24" />
        <div className="mt-4 flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-2.5 w-36" />
          </div>
        </div>
        <div className="skeleton mt-5 h-14 w-full" />
      </div>
    </div>
  );
}
