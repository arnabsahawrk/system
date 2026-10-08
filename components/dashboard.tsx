"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { WeekView } from "./week-view";
import { TrackerSection } from "./tracker-section";
import { SettingsSheet } from "./settings-sheet";
import { Sidebar } from "./sidebar";
import { LiveClock } from "./live-clock";
import { VerdictSheet } from "./verdict-sheet";
import { fireConfettiFrom } from "@/lib/confetti";
import { goToUnlock } from "@/lib/nav";
import { addDaysToDateKey, detectTimeZone, getAppDateKey, getAppDayIndex } from "@/lib/date";
import { clearTabUnlocked, isTabUnlocked } from "@/lib/tab-lock";
import { applyTick, completesDay } from "@/lib/week-state";
import type { CurrentWeek, HistoryStats, Verdict, WeekSummary } from "@/lib/types";
import type { Settings } from "@/lib/session";

const LOAD_TIMEOUT_MS = 9000;
const EMPTY_STATS: HistoryStats = { weekCount: 0, avgCompleted: 0, avgTotal: 0, avgPercent: 0 };
/** How long the "that tick didn't save" notice stays up. */
const TICK_ERROR_MS = 5000;
/** localStorage: the newest week whose closing sheet has been seen on this device. */
const VERDICT_SEEN_KEY = "system:verdict-seen";

function readSeenWeek(): number {
  try {
    const n = Number(window.localStorage.getItem(VERDICT_SEEN_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0; // storage blocked (private mode): the sheet may repeat, nothing breaks
  }
}

function markSeenWeek(weekNumber: number) {
  try {
    window.localStorage.setItem(VERDICT_SEEN_KEY, String(weekNumber));
  } catch {
    // see above
  }
}

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
  const [tickError, setTickError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const lastAppDate = useRef<string | null>(null);

  // --- keeping the screen and the server in step -------------------------
  // A tick is applied on screen the instant it's tapped and is NOT followed
  // by a re-fetch (that used to cost two extra requests per tick, one of
  // them opening the rollover transaction). Instead each tick sends the exact
  // state it wants, so it can't be flipped the wrong way by a retry or a
  // second device, and the screen is re-synced from the server only when
  // something went wrong. The refs below make sure a slow, older response can
  // never overwrite a tick made while it was still on the wire.
  const loadSeq = useRef(0); // newest load wins
  const inflight = useRef(0); // tick requests currently on the wire
  const mutations = useRef(0); // bumps when a tick starts and when it finishes
  const needsResync = useRef(false);
  const resyncTimer = useRef<number | null>(null);
  const tickErrorTimer = useRef<number | null>(null);
  const weekRef = useRef<CurrentWeek | null | undefined>(undefined);
  const loadWeekRef = useRef<() => Promise<void>>(async () => {});
  const verdictAsked = useRef(0);

  useEffect(() => {
    weekRef.current = week;
  }, [week]);

  // /api/week/current is the one call that actually runs the rollover
  // check (ensureCurrentWeek), which can change settings as a side effect
  // — pendingStartDate getting computed, or paused/pauseReason flipping
  // automatically — so it returns the settings read *after* that check,
  // in the same response, keeping e.g. the "Week 1 starts <date>" message
  // from ever showing stale data.
  const loadWeek = useCallback(async () => {
    const seq = ++loadSeq.current;
    const startedAt = mutations.current;
    const res = await fetch("/api/week/current");
    if (res.status === 401) {
      goToUnlock();
      return;
    }
    if (!res.ok) throw new Error(`week load failed: ${res.status}`);
    const data = (await res.json()) as { week: CurrentWeek | null; settings: Settings };
    if (seq !== loadSeq.current) return; // a newer load already answered
    if (inflight.current > 0 || mutations.current !== startedAt) {
      // A tick was sent or finished while this was in flight, so this
      // snapshot may predate it. Don't paint over the screen with it; fetch a
      // fresh one once the ticks have settled.
      if (resyncTimer.current) window.clearTimeout(resyncTimer.current);
      resyncTimer.current = window.setTimeout(() => {
        resyncTimer.current = null;
        loadWeekRef.current().catch(() => {});
      }, 600);
      return;
    }
    setWeek(data.week);
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    loadWeekRef.current = loadWeek;
  }, [loadWeek]);

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
      goToUnlock();
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
      loadWeek().catch(() => {});
      loadHistory().catch(() => {});
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

  useEffect(
    () => () => {
      if (resyncTimer.current) window.clearTimeout(resyncTimer.current);
      if (tickErrorTimer.current) window.clearTimeout(tickErrorTimer.current);
    },
    []
  );

  // The first time the app is opened after a week rolls over, show how that
  // week ended. Only the week that *just* ended qualifies (it must run right
  // up to the live week's start), and only once per device.
  useEffect(() => {
    if (loading || !week) return;
    const latest = history[0];
    if (!latest || !latest.finalized) return;
    if (addDaysToDateKey(latest.startDateKey, 7) !== week.startDateKey) return;
    if (readSeenWeek() >= latest.weekNumber) return;
    if (verdictAsked.current >= latest.weekNumber) return;
    verdictAsked.current = latest.weekNumber;
    fetch(`/api/week/verdict?week=${latest.weekNumber}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Verdict | null) => {
        if (v) setVerdict(v);
      })
      .catch(() => {});
  }, [loading, week, history]);

  const handleNoteSaved = useCallback((weekNumber: number, note: string | null) => {
    setHistory((h) => h.map((w) => (w.weekNumber === weekNumber ? { ...w, note } : w)));
  }, []);

  function closeVerdict() {
    if (verdict) markSeenWeek(verdict.weekNumber);
    setVerdict(null);
  }

  function showTickError() {
    setTickError("That tick didn't save — refreshing.");
    if (tickErrorTimer.current) window.clearTimeout(tickErrorTimer.current);
    tickErrorTimer.current = window.setTimeout(() => setTickError(null), TICK_ERROR_MS);
  }

  const toggleTask = useCallback(
    async (taskId: string, next: boolean, row: HTMLElement | null) => {
      // Celebrate the moment a day's last task is ticked — decided from what's
      // on screen right now, before the tick is applied.
      const current = weekRef.current;
      if (next && current && completesDay(current, taskId)) {
        fireConfettiFrom(row?.querySelector(".tick-box") ?? row);
      }

      setWeek((prev) => (prev ? applyTick(prev, taskId, next) : prev));
      mutations.current++;
      inflight.current++;
      let ok = false;
      try {
        const res = await fetch(`/api/week/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: next }),
        });
        if (res.status === 401) {
          goToUnlock();
          return;
        }
        ok = res.ok;
      } catch {
        ok = false; // offline or dropped: the server may or may not have it, so re-sync
      }
      inflight.current--;
      mutations.current++;

      if (!ok) {
        needsResync.current = true;
        showTickError();
      }
      // Once the last tick of a burst lands, re-sync only if one of them failed.
      if (inflight.current === 0 && needsResync.current) {
        needsResync.current = false;
        try {
          await loadWeek();
        } catch {
          setError("Couldn't refresh — check your connection.");
        }
      }
    },
    [loadWeek]
  );

  async function lockNow() {
    setLocking(true);
    await fetch("/api/passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    clearTabUnlocked();
    goToUnlock();
  }

  const timeZone = settings.timezone;
  const todayIndex = getAppDayIndex(now, timeZone);
  const showSkeleton = loading || week === undefined;

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
          className="rounded-lg p-2 text-ink-muted transition-all duration-200 hover:bg-surface-2 hover:text-ink active:scale-90"
        >
          <Menu size={20} />
        </button>
      </header>

      {(error || tickError) && (
        <div className="mx-auto flex max-w-6xl animate-fade-in flex-col gap-2 px-4 pt-2 sm:px-6" role="alert">
          {error && (
            <p className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
              {error}
            </p>
          )}
          {tickError && (
            <p className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
              {tickError}
            </p>
          )}
        </div>
      )}

      {showSkeleton ? (
        <>
          <DashboardSkeleton />
          {timedOut && (
            <div className="mx-auto flex max-w-6xl animate-fade-in flex-col items-center gap-2 px-4 pt-8 text-center">
              <p className="font-mono text-xs text-ink-muted">Still loading — this is taking longer than usual.</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
              >
                Reload
              </button>
            </div>
          )}
        </>
      ) : week === null ? (
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
          <WeekView week={week} todayIndex={todayIndex} onToggleTask={toggleTask} />

          <div className="mx-auto max-w-6xl animate-rise px-4 pt-6 sm:px-6" style={{ animationDelay: "240ms" }}>
            <TrackerSection
              history={history}
              stats={stats}
              hasMore={hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              currentWeek={week}
              todayIndex={todayIndex}
              onNoteSaved={handleNoteSaved}
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

      {verdict && <VerdictSheet verdict={verdict} onClose={closeVerdict} onNoteSaved={handleNoteSaved} />}
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
