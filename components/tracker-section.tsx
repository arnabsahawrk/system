"use client";

import { useState } from "react";
import { TrackerTable } from "./tracker-table";
import { TrackerChart } from "./tracker-chart";
import type { WeekSummary } from "@/lib/types";

export function TrackerSection({ weeks }: { weeks: WeekSummary[] }) {
  const [tab, setTab] = useState<"tracker" | "chart">("tracker");

  return (
    <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-1 font-mono text-xs">
        <TabButton active={tab === "tracker"} onClick={() => setTab("tracker")}>
          {"\u2605"} Tracker
        </TabButton>
        <TabButton active={tab === "chart"} onClick={() => setTab("chart")}>
          {"\u23F1"} Chart
        </TabButton>
      </div>
      {tab === "tracker" ? <TrackerTable weeks={weeks} /> : <TrackerChart weeks={weeks} />}
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
