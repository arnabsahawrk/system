/** What the dashboard looks like while its data is still on the way: the
 * real shape of the screen as grey blocks, so the page appears at once and
 * fills in, instead of a blank screen with one pulsing logo. Pure CSS — both
 * the phone and the wide layout are in the markup and a breakpoint picks. */
export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 sm:px-6" aria-busy="true" aria-label="Loading your week">
      {/* phones: today, weekly, the rest */}
      <div className="flex flex-col gap-6 sm:hidden">
        <div>
          <div className="skeleton mb-3 h-3 w-14" />
          <CardSkeleton rows={4} />
        </div>
        <div>
          <div className="skeleton mb-3 h-3 w-16" />
          <div className="rounded-xl2 border border-border bg-surface p-4">
            <div className="skeleton mx-auto mt-2 h-12 w-32" />
            <div className="skeleton mx-auto mt-3 h-3 w-40" />
            <div className="skeleton mt-5 h-2 w-full rounded-full" />
            <div className="mt-5 flex justify-between">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="skeleton h-9 w-9 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-[52px] items-center gap-3 border-b border-border px-4 last:border-b-0">
              <div className="skeleton h-6 w-6 rounded-full" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* wider screens: the card grid and the weekly aside */}
      <div className="hidden gap-6 sm:flex lg:flex-row lg:items-start">
        <div className="flex-1">
          <div className="skeleton mb-3 h-3 w-20" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} rows={3} />
            ))}
          </div>
        </div>
        <div className="hidden w-[320px] shrink-0 lg:block">
          <div className="skeleton mb-3 h-3 w-16" />
          <div className="h-[330px] rounded-xl2 border border-border bg-surface" />
        </div>
      </div>
    </main>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-border bg-surface">
      <div className="h-[41px] bg-surface-2" />
      <div className="flex flex-col gap-2 px-4 py-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-[22px] w-[22px] rounded-[7px]" />
            <div className="skeleton h-3" style={{ width: `${70 - i * 9}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
