"use client";

import { useState, type FormEvent } from "react";
import { markTabUnlocked } from "@/lib/tab-lock";
import { BrandMark } from "@/components/brand-mark";

export default function UnlockPage() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [misses, setMisses] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock", passcode }),
    });
    if (res.ok) {
      markTabUnlocked();
      // A full navigation, not the client router — this is the one place a
      // stuck soft-navigation would be most confusing to land on.
      window.location.href = "/";
      return;
    }
    setBusy(false);
    setErr("Wrong passcode.");
    setPasscode("");
    setMisses((m) => m + 1);
  }

  async function forgot() {
    setRecovering(true);
    setErr(null);
    const res = await fetch("/api/passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recover" }),
    });
    setRecovering(false);
    if (res.ok) setRecovered(true);
    else setErr("Couldn't send it — check BREVO_API_KEY is set.");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-6 text-ink">
      <div className="flex flex-col items-center gap-3">
        <BrandMark size={44} className={busy ? "animate-pulse-soft" : undefined} />
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted">Locked</p>
          <p className="mt-1 font-mono text-sm text-ink">Enter passcode</p>
        </div>
      </div>

      <form onSubmit={submit} className="w-full max-w-xs">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="••••"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-ink focus:border-accent focus:outline-none"
        />
        {err && <p className="mt-2 text-center text-sm text-clay-strong">{err}</p>}
        <button
          type="submit"
          disabled={busy || !passcode}
          className="mt-4 w-full rounded-lg bg-accent py-3 font-mono text-sm font-semibold text-[#141210] disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>

        {misses >= 3 && (
          <div className="mt-5 text-center">
            {recovered ? (
              <p className="font-mono text-xs text-accent">Sent to your email.</p>
            ) : (
              <button
                type="button"
                onClick={forgot}
                disabled={recovering}
                className="font-mono text-xs text-ink-muted underline decoration-dotted underline-offset-4 hover:text-ink disabled:opacity-40"
              >
                {recovering ? "Sending…" : "Forgot passcode?"}
              </button>
            )}
          </div>
        )}
      </form>
    </main>
  );
}
