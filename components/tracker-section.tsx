"use client";

import { useState } from "react";
import { TrackerTable } from "./tracker-table";
import { TrackerChart } from "./tracker-chart";
import type { CurrentWeek, HistoryStats, WeekSummary } from "@/lib/types";

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
  const [tab, setTab] = useState<"history" | "trend">("history");
  const allWeeks: WeekSummary[] = currentWeek
    ? [{ ...currentWeek, finalized: false }, ...history]
    : history;

  return (
    <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-1 font-mono text-xs">
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
        <TabButton active={tab === "trend"} onClick={() => setTab("trend")}>
          Trend
        </TabButton>
      </div>

      {tab === "history" ? (
        <>
          <TrackerTable weeks={allWeeks} stats={stats} />
          {hasMore && (
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="self-center rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted hover:border-border-strong hover:text-ink disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load 10 more"}
            </button>
          )}
        </>
      ) : (
        <TrackerChart weeks={allWeeks} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 uppercase tracking-wider transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
