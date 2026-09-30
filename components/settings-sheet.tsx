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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [firstPasscode, setFirstPasscode] = useState("");
  const [firstPasscodeConfirm, setFirstPasscodeConfirm] = useState("");

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
    if (await callPasscode("change", { currentPasscode: confirmPasscode, newPasscode })) {
      markTabUnlocked();
      setMsg("Passcode changed.");
      setNewPasscode("");
    }
  }

  async function handleRemove() {
    if (await callPasscode("remove", { passcode: confirmPasscode })) {
      setMsg("Passcode removed — the app is unlocked for anyone with this link.");
      setConfirmPasscode("");
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
        body: JSON.stringify({ action, passcode: confirmPasscode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data?.error ?? "Something went wrong");
      const pendingAction = action === "cancel" ? null : action;
      onSettingsChanged({ pendingAction });
      setMsg(
        action === "cancel"
          ? "Cancelled."
          : `Will ${action} at the next reset (Saturday 06:00).`
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    const next = !settings.notificationsEnabled;
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationsEnabled: next }),
      });
      if (res.ok) onSettingsChanged({ notificationsEnabled: next });
    } finally {
      setBusy(false);
    }
  }

  const pauseLabel = settings.paused
    ? settings.pendingAction === "resume"
      ? "Resuming at next reset"
      : "Paused"
    : settings.pendingAction === "pause"
      ? "Pausing at next reset"
      : "Running";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Settings</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {msg && <p className="mb-3 font-mono text-xs text-accent">{msg}</p>}
        {err && <p className="mb-3 font-mono text-xs text-clay-strong">{err}</p>}

        <div className="flex flex-col gap-5">
          {/* Passcode */}
          {!settings.hasPasscode ? (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-ink-muted">Passcode</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="New passcode"
                value={firstPasscode}
                onChange={(e) => setFirstPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Confirm"
                value={firstPasscodeConfirm}
                onChange={(e) => setFirstPasscodeConfirm(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleSet}
                disabled={busy}
                className="rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] disabled:opacity-40"
              >
                Set passcode
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-ink-muted">Passcode</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Current passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="New passcode"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleChange}
                  disabled={busy || !confirmPasscode || !newPasscode}
                  className="flex-1 rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] disabled:opacity-40"
                >
                  Change
                </button>
                <button
                  onClick={handleRemove}
                  disabled={busy || !confirmPasscode}
                  className="flex-1 rounded-lg border border-clay/40 py-2 font-mono text-sm text-clay-strong disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-border" />

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-ink-muted">Weekly email</p>
              <p className="font-mono text-[10px] text-ink-faint">
                {settings.notificationsEnabled ? "On" : "Off"}
              </p>
            </div>
            <Switch checked={settings.notificationsEnabled} onChange={toggleNotifications} disabled={busy} />
          </div>

          <div className="border-t border-border" />

          {/* Pause */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-ink-muted">System</p>
              <span className="font-mono text-[10px] text-ink-faint">{pauseLabel}</span>
            </div>
            {settings.hasPasscode && !confirmPasscode && (
              <p className="font-mono text-[10px] text-ink-faint">
                Enter your current passcode above to pause or resume.
              </p>
            )}
            <div className="flex gap-2">
              {settings.pendingAction ? (
                <button
                  onClick={() => handlePause("cancel")}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-border py-2 font-mono text-sm text-ink-muted disabled:opacity-40"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => handlePause(settings.paused ? "resume" : "pause")}
                  disabled={busy || (settings.hasPasscode && !confirmPasscode)}
                  className="flex-1 rounded-lg border border-clay/40 py-2 font-mono text-sm text-clay-strong disabled:opacity-40"
                >
                  {settings.paused ? "Resume" : "Pause"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-surface-2 border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
