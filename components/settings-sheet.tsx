"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { markTabUnlocked } from "@/lib/tab-lock";
import type { Settings } from "@/lib/session";

export function SettingsSheet({
  settings,
  onClose,
  onPasscodeChanged,
}: {
  settings: Settings;
  onClose: () => void;
  onPasscodeChanged: (hasPasscode: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [currentPasscode, setCurrentPasscode] = useState("");

  async function call(action: string, body: Record<string, unknown> = {}) {
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
    if (newPasscode.length < 4) return setErr("Use at least 4 characters");
    if (newPasscode !== confirmPasscode) return setErr("Passcodes don't match");
    if (await call("set", { passcode: newPasscode })) {
      markTabUnlocked();
      setMsg("Passcode set.");
      setNewPasscode("");
      setConfirmPasscode("");
      onPasscodeChanged(true);
    }
  }

  async function handleChange() {
    if (newPasscode.length < 4) return setErr("Use at least 4 characters");
    if (await call("change", { currentPasscode, newPasscode })) {
      markTabUnlocked();
      setMsg("Passcode changed.");
      setCurrentPasscode("");
      setNewPasscode("");
    }
  }

  async function handleRemove() {
    if (await call("remove", { passcode: currentPasscode })) {
      setMsg("Passcode removed — the app is unlocked for anyone with this link.");
      setCurrentPasscode("");
      onPasscodeChanged(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Settings</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-ink-muted">
          Weekly email goes to {settings.notifyEmail}
        </div>

        {msg && <p className="mb-3 font-mono text-xs text-accent">{msg}</p>}
        {err && <p className="mb-3 font-mono text-xs text-clay-strong">{err}</p>}

        {!settings.hasPasscode ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-ink-muted">Set a passcode</p>
            <input
              type="password"
              inputMode="numeric"
              placeholder="New passcode"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm passcode"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleSet}
              disabled={busy}
              className="mt-1 rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] disabled:opacity-40"
            >
              Set passcode
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-ink-muted">Change passcode</p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Current passcode"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
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
              <button
                onClick={handleChange}
                disabled={busy}
                className="rounded-lg bg-accent py-2 font-mono text-sm font-semibold text-[#141210] disabled:opacity-40"
              >
                Change passcode
              </button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="font-mono text-xs text-ink-muted">Remove passcode</p>
              <button
                onClick={handleRemove}
                disabled={busy || !currentPasscode}
                className="rounded-lg border border-clay/40 py-2 font-mono text-sm text-clay-strong disabled:opacity-40"
              >
                Remove (uses the current passcode above)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
