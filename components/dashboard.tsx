"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ListChecks, Settings as SettingsIcon } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { DayCard } from "./day-card";
import { WeeklySummaryCard } from "./weekly-summary-card";
import { TrackerSection } from "./tracker-section";
import { SettingsSheet } from "./settings-sheet";
import { detectTimeZone, getAppDateKey, getAppDayIndex } from "@/lib/date";
import { clearTabUnlocked, isTabUnlocked } from "@/lib/tab-lock";
import type { CurrentWeek, WeekSummary } from "@/lib/types";
import type { Settings } from "@/lib/session";

export function Dashboard({ initialSettings }: { initialSettings: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [week, setWeek] = useState<CurrentWeek | null>(null);
  const [history, setHistory] = useState<WeekSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lastAppDate = useRef<string | null>(null);

  const loadWeek = useCallback(async () => {
    const res = await fetch("/api/week/current");
    if (res.status === 401) {
      router.replace("/unlock");
      return;
    }
    if (res.ok) setWeek(await res.json());
  }, [router]);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/week/history");
    if (res.ok) setHistory(await res.json());
  }, []);

  // Same tab-lock idea as Streakment: the server cookie lives for the whole
  // browser session, so a reopened tab would otherwise still pass it. This
  // sessionStorage check makes each tab ask again on open regardless.
  useEffect(() => {
    if (initialSettings.hasPasscode && !isTabUnlocked()) {
      router.replace("/unlock");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actively locks the moment this tab closes, so even a browser that
  // restores sessionStorage on tab restore still finds the cookie gone.
  useEffect(() => {
    if (!settings.hasPasscode) return;
    const onHide = () => {
      navigator.sendBeacon(
        "/api/passcode",
        new Blob([JSON.stringify({ action: "lock" })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [settings.hasPasscode]);

  // Keeps the stored timezone following the person, not the device — see
  // /api/settings PATCH. Only writes when it actually changed.
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWeek(), loadHistory()])
      .catch(() => setError("Couldn't load your data — check the API/database are reachable."))
      .finally(() => setLoading(false));
  }, [loadWeek, loadHistory]);

  // Keeps "today" honest if the tab stays open across 6:00 AM: re-reads the
  // clock every minute (and the moment the tab becomes visible again) and,
  // when the app-day changes, reloads so a rollover shows up without a refresh.
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
    try {
      await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      });
      clearTabUnlocked();
      router.replace("/unlock");
    } finally {
      setLocking(false);
    }
  }

  const timeZone = settings.timezone;
  const todayIndex = getAppDayIndex(now, timeZone);

  if (loading || !week) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <BrandMark size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg pb-16 text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-2 pt-8 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <div>
            <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em]">System</h1>
            <p className="font-mono text-[10px] text-ink-faint">{timeZone}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/manage"
            title="Manage tasks"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <ListChecks size={18} />
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <SettingsIcon size={18} />
          </button>
          {settings.hasPasscode && (
            <button
              onClick={lockNow}
              disabled={locking}
              title="Lock now"
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              <Lock size={18} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
          <p className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
            {error}
          </p>
        </div>
      )}

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:flex-row lg:items-start">
        <section className="flex-1">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
            Everyday
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {week.days.map((day, i) => (
              <DayCard
                key={day.dayIndex}
                day={day}
                isUnlocked={i === todayIndex}
                onToggleTask={toggleTask}
              />
            ))}
          </div>
        </section>

        <aside className="w-full lg:w-[320px] lg:shrink-0">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
            Weekly
          </h2>
          <WeeklySummaryCard week={week} todayIndex={todayIndex} />
        </aside>
      </main>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <TrackerSection weeks={[...history, { ...week, finalized: false }]} />
      </div>

      <footer className="mx-auto max-w-6xl px-4 pt-10 text-center sm:px-6">
        <a
          href="https://arnabsaha.vercel.app/"
          className="font-mono text-[11px] text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink-muted"
        >
          A project by Arnab Saha
        </a>
      </footer>

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onPasscodeChanged={(hasPasscode) => setSettings((s) => ({ ...s, hasPasscode }))}
        />
      )}
    </div>
  );
}
