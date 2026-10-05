"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { DayCard } from "./day-card";
import { WeeklySummaryCard } from "./weekly-summary-card";
import { TrackerSection } from "./tracker-section";
import { SettingsSheet } from "./settings-sheet";
import { Sidebar } from "./sidebar";
import { LiveClock } from "./live-clock";
import { detectTimeZone, getAppDateKey, getAppDayIndex } from "@/lib/date";
import { clearTabUnlocked, isTabUnlocked } from "@/lib/tab-lock";
import type { CurrentWeek, HistoryStats, WeekSummary } from "@/lib/types";
import type { Settings } from "@/lib/session";

const LOAD_TIMEOUT_MS = 9000;
const EMPTY_STATS: HistoryStats = { weekCount: 0, avgCompleted: 0, avgTotal: 0, avgPercent: 0 };

export function Dashboard({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [week, setWeek] = useState<CurrentWeek | null | undefined>(undefined); // undefined = not loaded yet
  const [history, setHistory] = useState<WeekSummary[]>([]);
  const [stats, setStats] = useState<HistoryStats>(EMPTY_STATS);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lastAppDate = useRef<string | null>(null);

  // /api/week/current is the one call that actually runs the rollover
  // check (ensureCurrentWeek), which can change settings as a side effect
  // — pendingStartDate getting computed, or paused/pauseReason flipping
  // automatically. Re-reading settings right after is what keeps e.g. the
  // "Week 1 starts <date>" message from showing stale data.
  const loadWeek = useCallback(async () => {
    const res = await fetch("/api/week/current");
    if (res.status === 401) {
      window.location.href = "/unlock";
      return;
    }
    if (res.ok) setWeek(await res.json());
    const settingsRes = await fetch("/api/settings");
    if (settingsRes.ok) setSettings(await settingsRes.json());
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/week/history");
    if (res.ok) {
      const page = await res.json();
      setHistory(page.weeks);
      setStats(page.stats);
      setHasMore(page.hasMore);
    }
  }, []);

  async function loadMore() {
    const oldest = history[history.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/week/history?before=${oldest.weekNumber}`);
      if (res.ok) {
        const page = await res.json();
        setHistory((prev) => [...prev, ...page.weeks]);
        setStats(page.stats);
        setHasMore(page.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // Same tab-lock idea as Streakment: the server cookie lives for the whole
  // browser session, so a reopened tab would otherwise still pass it. This
  // sessionStorage check makes each tab ask again on open regardless. A
  // hard navigation (not the client router) so this can never be left
  // half-finished by a stalled soft-navigation.
  useEffect(() => {
    if (initialSettings.hasPasscode && !isTabUnlocked()) {
      window.location.href = "/unlock";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actively locks the moment this tab closes, so even a browser that
  // restores sessionStorage on tab restore still finds the cookie gone.
  useEffect(() => {
    if (!settings.hasPasscode) return;
    const onHide = (e: PageTransitionEvent) => {
      if (e.persisted) return; // bfcache suspend, not a close
      navigator.sendBeacon(
        "/api/passcode",
        new Blob([JSON.stringify({ action: "lock" })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [settings.hasPasscode]);

  // Keeps the stored timezone following the person, not the device.
  useEffect(() => {
    const detected = detectTimeZone();
    if (detected && detected !== settings.timezone) {
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: detected }),
      })
        .then(() => setSettings((s) => ({ ...s, timezone: detected })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps "today" honest if the tab stays open across 6:00 AM.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const appDate = getAppDateKey(now, settings.timezone);
  useEffect(() => {
    if (lastAppDate.current !== null && lastAppDate.current !== appDate) {
      loadWeek();
      loadHistory();
    }
    lastAppDate.current = appDate;
  }, [appDate, loadWeek, loadHistory]);

  useEffect(() => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    Promise.all([loadWeek(), loadHistory()])
      .catch(() => setError("Couldn't load your data — check the API/database are reachable."))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTask(taskId: string) {
    setWeek((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
      }));
      return { ...prev, days };
    });
    const res = await fetch(`/api/week/tasks/${taskId}`, { method: "PATCH" });
    if (!res.ok) setError("That tick didn't save — refreshing.");
    await loadWeek();
    if (res.ok) setError(null);
  }

  async function lockNow() {
    setLocking(true);
    await fetch("/api/passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    clearTabUnlocked();
    window.location.href = "/unlock";
  }

  const timeZone = settings.timezone;
  const todayIndex = getAppDayIndex(now, timeZone);

  if (loading || week === undefined) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6">
        <BrandMark size={36} className="animate-pulse-soft" />
        {timedOut && (
          <div className="flex animate-fade-in flex-col items-center gap-2 text-center">
            <p className="font-mono text-xs text-ink-muted">Still loading — this is taking longer than usual.</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-border px-3 py-1 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh animate-fade-in bg-bg pb-16 text-ink">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        hasPasscode={settings.hasPasscode}
        onLockNow={lockNow}
        onOpenSettings={() => {
          setSidebarOpen(false);
          setSettingsOpen(true);
        }}
        locking={locking}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-2 pt-8 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <div>
            <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em]">System</h1>
            <LiveClock timeZone={timeZone} />
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Menu size={20} />
        </button>
      </header>

      {error && (
        <div className="mx-auto max-w-6xl animate-fade-in px-4 pt-2 sm:px-6">
          <p className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
            {error}
          </p>
        </div>
      )}

      {week === null ? (
        settings.paused && settings.pauseReason === "manual" ? (
          <PausedState pendingAction={settings.pendingAction} onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          // Same screen whether this is the very first week ever (never
          // started) or an existing system that ran out of tasks to track
          // — both boil down to "nothing to do until a task exists."
          <NotStartedState
            pendingStartDate={settings.pendingStartDate}
            previouslyRan={settings.pauseReason === "no_tasks"}
            timeZone={timeZone}
          />
        )
      ) : (
        <>
          <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:flex-row lg:items-start">
            <section className="flex-1">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Everyday</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {week.days.map((day, i) => (
                  <DayCard key={day.dayIndex} day={day} isUnlocked={i === todayIndex} onToggleTask={toggleTask} />
                ))}
              </div>
            </section>

            <aside className="w-full lg:w-[320px] lg:shrink-0">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Weekly</h2>
              <WeeklySummaryCard week={week} todayIndex={todayIndex} />
            </aside>
          </main>

          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
            <TrackerSection
              history={history}
              stats={stats}
              hasMore={hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              currentWeek={week}
            />
          </div>
        </>
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSettingsChanged={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        />
      )}
    </div>
  );
}

function NotStartedState({
  pendingStartDate,
  previouslyRan,
  timeZone,
}: {
  pendingStartDate: string | null;
  previouslyRan: boolean;
  timeZone: string;
}) {
  const formatted = pendingStartDate
    ? (() => {
        const [y, m, d] = pendingStartDate.split("-").map(Number);
        return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
          timeZone: "UTC",
          weekday: "long",
          month: "long",
          day: "numeric",
        });
      })()
    : null;

  const heading = formatted
    ? previouslyRan
      ? "Starting back up"
      : "Week 1 is coming up"
    : previouslyRan
      ? "No tasks are set"
      : "Nothing set up yet";

  const body = formatted
    ? `A task is set — tracking ${previouslyRan ? "resumes" : "starts"} ${formatted} at 06:00 (${timeZone}). Add or adjust tasks any time before then.`
    : previouslyRan
      ? "Every task was removed, so there's nothing to track right now. Add one in Manage Tasks and it picks back up at the next reset (Saturday 06:00) — no other step needed."
      : "Add your first tasks in Manage Tasks. Week 1 starts the next time the clock hits Saturday 06:00 after that.";

  return (
    <div className="mx-auto flex max-w-6xl animate-fade-in flex-col items-center gap-3 px-4 pt-20 text-center sm:px-6">
      <BrandMark size={32} className="opacity-60" />
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-ink-muted">{heading}</h2>
      <p className="max-w-xs font-mono text-xs text-ink-faint">{body}</p>
      <Link
        href="/manage"
        className="mt-2 rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
      >
        Manage tasks
      </Link>
    </div>
  );
}

function PausedState({
  pendingAction,
  onOpenSettings,
}: {
  pendingAction: "pause" | "resume" | null;
  onOpenSettings: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl animate-fade-in flex-col items-center gap-3 px-4 pt-20 text-center sm:px-6">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 9v6M14 9v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-ink-muted">System is paused</h2>
      <p className="max-w-xs font-mono text-xs text-ink-faint">
        {pendingAction === "resume"
          ? "Resuming at the next reset (Saturday 06:00)."
          : "Nothing is being tracked or emailed right now."}
      </p>
      <button
        onClick={onOpenSettings}
        className="mt-2 rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
      >
        Open Settings
      </button>
    </div>
  );
}
