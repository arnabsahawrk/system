"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { markTabUnlocked } from "@/lib/tab-lock";
import type { Settings } from "@/lib/session";

export function SettingsSheet({
  settings,
  onClose,
  onSettingsChanged,
}: {
  settings: Settings;
  onClose: () => void;
  onSettingsChanged: (patch: Partial<Settings>) => void;
}) {
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pausePasscode, setPausePasscode] = useState("");
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [firstPasscode, setFirstPasscode] = useState("");
  const [firstPasscodeConfirm, setFirstPasscodeConfirm] = useState("");

  function close() {
    setClosing(true);
    setTimeout(onClose, 180); // matches the exit transition below
  }

  async function callPasscode(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Something went wrong");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleSet() {
    if (firstPasscode.length < 4) return setErr("Use at least 4 characters");
    if (firstPasscode !== firstPasscodeConfirm) return setErr("Passcodes don't match");
    if (await callPasscode("set", { passcode: firstPasscode })) {
      markTabUnlocked();
      setMsg("Passcode set.");
      setFirstPasscode("");
      setFirstPasscodeConfirm("");
      onSettingsChanged({ hasPasscode: true });
    }
  }

  async function handleChange() {
    if (newPasscode.length < 4) return setErr("New passcode needs at least 4 characters");
    if (await callPasscode("change", { currentPasscode, newPasscode })) {
      markTabUnlocked();
      setMsg("Passcode changed.");
      setCurrentPasscode("");
      setNewPasscode("");
    }
  }

  async function handleRemove() {
    if (await callPasscode("remove", { passcode: currentPasscode })) {
      setMsg("Passcode removed — the app is unlocked for anyone with this link.");
      setCurrentPasscode("");
      onSettingsChanged({ hasPasscode: false });
    }
  }

  async function handlePause(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, passcode: pausePasscode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data?.error ?? "Something went wrong");
      const pendingAction = action === "cancel" ? null : action;
      onSettingsChanged({ pendingAction });
      setPausePasscode("");
      setMsg(action === "cancel" ? "Cancelled." : `Will ${action} at the next reset (Saturday 06:00).`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    const next = !settings.notificationsEnabled;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationsEnabled: next }),
      });
      if (res.ok) onSettingsChanged({ notificationsEnabled: next });
      else setErr("Couldn't change that — try again.");
    } finally {
      setBusy(false);
    }
  }

  const pauseLabel = settings.paused
    ? settings.pendingAction === "resume"
      ? "Resuming at next reset"
      : settings.pauseReason === "no_tasks"
        ? "Paused — no tasks set"
        : "Paused"
    : settings.pendingAction === "pause"
      ? "Pausing at next reset"
      : "Running";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/50 transition-opacity duration-200 sm:items-center ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 transition-all duration-200 sm:rounded-2xl ${
          closing ? "translate-y-3 opacity-0 sm:translate-y-0 sm:scale-95" : "translate-y-0 opacity-100 sm:scale-100"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Settings</h2>
          <button onClick={close} className="text-ink-faint transition-colors hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {msg && <p className="mb-3 font-mono text-xs text-accent">{msg}</p>}
        {err && <p className="mb-3 font-mono text-xs text-clay-strong">{err}</p>}

        <div className="flex flex-col gap-5">
          {/* 1. Weekly email */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-ink-muted">Weekly email</p>
              <p className="font-mono text-[10px] text-ink-faint">
                {settings.notificationsEnabled ? "On" : "Off"} — sent when the week resets
              </p>
            </div>
            <Switch checked={settings.notificationsEnabled} onChange={toggleNotifications} disabled={busy} />
          </div>

          <div className="border-t border-border" />

          {/* 2. System (pause/resume) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-ink-muted">System</p>
              <span className="font-mono text-[10px] text-ink-faint">{pauseLabel}</span>
            </div>
            {settings.hasPasscode && (
              <input
                type="password"
                inputMode="numeric"
                placeholder="Passcode, to pause or resume"
                value={pausePasscode}
                onChange={(e) => setPausePasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              />
            )}
            <div className="flex gap-2">
              {settings.pendingAction ? (
                <button
                  onClick={() => handlePause("cancel")}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-border py-2 font-mono text-sm text-ink-muted transition-all active:scale-95 disabled:opacity-40"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => handlePause(settings.paused ? "resume" : "pause")}
                  disabled={busy || (settings.hasPasscode && !pausePasscode)}
                  className="flex-1 rounded-lg border border-clay/40 py-2 font-mono text-sm text-clay-strong transition-all active:scale-95 disabled:opacity-40"
                >
                  {settings.paused ? "Resume" : "Pause"}
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* 3. App passcode */}
          {!settings.hasPasscode ? (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-ink-muted">App passcode</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="New passcode"
                value={firstPasscode}
                onChange={(e) => setFirstPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Confirm"
                value={firstPasscodeConfirm}
                onChange={(e) => setFirstPasscodeConfirm(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleSet}
                disabled={busy}
                className="rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] transition-all active:scale-95 disabled:opacity-40"
              >
                Set passcode
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-ink-muted">App passcode</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Current passcode"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="New passcode"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleChange}
                  disabled={busy || !currentPasscode || !newPasscode}
                  className="flex-1 rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] transition-all active:scale-95 disabled:opacity-40"
                >
                  Change
                </button>
                <button
                  onClick={handleRemove}
                  disabled={busy || !currentPasscode}
                  className="flex-1 rounded-lg border border-clay/40 py-2 font-mono text-sm text-clay-strong transition-all active:scale-95 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Track: 48x28. Ball: 20x20, 4px margin on every side in both states
 * (4 + 20 + 4 = 28 vertically; checked sits at 48 - 20 - 4 = 24px from the
 * left, i.e. 4px from the right — symmetric). overflow-hidden on the track
 * as a second line of defense so the ball can never visually escape it. */
function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors duration-200 disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-surface-2 border border-border"
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-ink transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
