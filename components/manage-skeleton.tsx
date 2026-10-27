import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

/** The layout classes of the Manage Tasks body, shared by the real screen and
 * its skeleton so the two can't drift apart: a column on phones, the task list
 * beside the week from 1024px. */
export const MANAGE_LAYOUT =
  "mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6";

/** Page chrome for Manage tasks: header and the one-line reminder. Used by the
 * real screen and by the route's loading screen (app/manage/loading.tsx). */
export function ManageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh animate-fade-in bg-bg pb-16 text-ink">
      <PageHeader title="Manage tasks" />
      <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2.5 font-mono text-xs text-ink-muted">
          Changes apply from the next reset (Saturday 6:00 AM). This week stays exactly as it is.
        </p>
      </div>
      {children}
    </div>
  );
}

export function ManageSkeleton() {
  return (
    <ManageFrame>
      <ManageBodySkeleton />
    </ManageFrame>
  );
}

const CARD = "overflow-hidden rounded-xl2 border border-border bg-surface";

function HeadSkeleton() {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="skeleton h-3 w-14" />
      <div className="skeleton h-3 w-16" />
    </div>
  );
}

/** The two sections as grey blocks: the task list (rows, then the add field)
 * and the seven day cards. */
export function ManageBodySkeleton() {
  return (
    <div className={MANAGE_LAYOUT} aria-busy="true" aria-label="Loading your tasks">
      <section>
        <HeadSkeleton />
        <div className={`${CARD} shadow-card`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex min-h-[57px] items-center gap-2 border-b border-border px-2 py-1.5">
              <div className="skeleton h-9 w-8" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-2">
                <div className="skeleton h-3" style={{ width: `${68 - i * 9}%` }} />
                <div className="skeleton h-2.5 w-24" />
              </div>
              <div className="skeleton h-4 w-4" />
              <div className="skeleton h-4 w-4" />
            </div>
          ))}
          <div className="flex gap-2 p-3">
            <div className="skeleton h-10 flex-1" />
            <div className="skeleton h-10 w-10" />
          </div>
        </div>
      </section>

      <section>
        <HeadSkeleton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={CARD}>
              <div className="flex h-[41px] items-center justify-between bg-surface-2 px-4">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-12" />
              </div>
              <div className="flex flex-col gap-0.5 px-2 py-2.5">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex h-10 items-center gap-1 px-1">
                    <div className="skeleton h-8 w-6" />
                    <div className="skeleton h-3" style={{ width: `${72 - j * 15}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
