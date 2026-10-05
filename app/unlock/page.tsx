"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Fingerprint } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  askForUnlock,
  BiometricError,
  biometricName,
  biometricSupported,
  clearBiometricMarker,
  errorMessage,
  finishUnlock,
  getBiometricMarker,
  isFresh,
  prepareUnlock,
  type PreparedUnlock,
  type UnlockAnswer,
} from "@/lib/biometric";
import { markTabUnlocked } from "@/lib/tab-lock";

export default function UnlockPage() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Biometric unlock. Only offered on a device that turned it on in Settings
  // and whose browser can do it; the passcode form below works either way.
  const [bio, setBio] = useState<"off" | "ready">("off");
  const [bioBusy, setBioBusy] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  // What the button does next: "start" a prompt, "resend" an answer the server
  // couldn't be reached with, or "reload" the page (see unlockWithBiometrics).
  const [retry, setRetry] = useState<"start" | "resend" | "reload">("start");
  const prepared = useRef<PreparedUnlock | null>(null);
  const pending = useRef<UnlockAnswer | null>(null);
  const prompted = useRef(false);
  const working = useRef(false);

  /** Success, whichever way in: a short fade, then a full page load. The
   * dashboard fades in on its own, so the two halves read as one movement.
   * A full navigation rather than the client router, so it can't be left
   * half-finished by a stalled soft-navigation, and `replace` so Back never
   * lands on the lock screen again. */
  function enter() {
    markTabUnlocked();
    setLeaving(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => window.location.replace("/"), calm ? 0 : 200);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", passcode }),
      });
      if (res.ok) {
        enter();
        return;
      }
      setErr("Wrong passcode.");
      setPasscode("");
      setMisses((m) => m + 1);
      setShake(true);
      setTimeout(() => setShake(false), 350);
    } catch {
      // Offline: say so, instead of leaving the button stuck on "Checking…".
      setErr("Couldn't reach the app. Check the connection.");
    }
    setBusy(false);
  }

  async function forgot() {
    setRecovering(true);
    setErr(null);
    try {
      const res = await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recover" }),
      });
      if (res.ok) setRecovered(true);
      else setErr("Couldn't send it — check BREVO_API_KEY is set.");
    } catch {
      setErr("Couldn't reach the app. Check the connection.");
    }
    setRecovering(false);
  }

  function dropBiometrics(message: string) {
    // Removed from another device, or the passcode was removed and set again.
    clearBiometricMarker();
    setBio("off");
    setErr(message);
  }

  /** Gets a one-time challenge ready ahead of the tap, so the Touch ID / Face
   * ID sheet can open straight from the tap itself (Safari insists on that). */
  const refresh = useCallback(async () => {
    const id = getBiometricMarker();
    if (!id) return;
    try {
      prepared.current = await prepareUnlock(id);
    } catch (e) {
      prepared.current = null;
      if (e instanceof BiometricError && e.kind === "unknown-credential") {
        clearBiometricMarker();
        setBio("off");
        setErr(e.message);
      }
      // Offline or a server hiccup: the button stays, and retries on tap.
    }
  }, []);

  async function unlockWithBiometrics() {
    const id = getBiometricMarker();
    if (!id || working.current) return;
    working.current = true;
    setBioBusy(true);
    setBioMsg(null);
    setErr(null);
    try {
      // A signed answer the server couldn't be reached with is simply sent
      // again: the sensor already did its part, so there is no second prompt.
      let answer: UnlockAnswer;
      const kept = pending.current;
      if (kept) {
        answer = kept;
      } else {
        // The browser prompt is the first thing this tap does whenever a
        // challenge is already waiting. If one isn't, it is fetched first,
        // which Safari also accepts as part of the same tap.
        const ready = prepared.current;
        prepared.current = null;
        if (ready && isFresh(ready)) {
          prompted.current = true;
          answer = await askForUnlock(ready);
        } else {
          const fresh = await prepareUnlock(id);
          prompted.current = true;
          answer = await askForUnlock(fresh);
        }
        pending.current = answer;
      }
      await finishUnlock(answer);
      enter();
      return;
    } catch (e) {
      if (e instanceof BiometricError && e.kind === "unknown-credential") {
        pending.current = null;
        dropBiometrics(e.message);
      } else if (e instanceof BiometricError && e.kind === "network" && pending.current) {
        // The finger was fine; the connection wasn't. Keep the answer.
        setBioMsg(e.message);
        setRetry("resend");
      } else {
        pending.current = null;
        setBioMsg(errorMessage(e, "Biometrics didn't work. Use the passcode instead."));
        // iOS Safari has been seen to refuse a second prompt within one page
        // session (WebKit bug 241126), so once a prompt has been shown the
        // safe retry is a fresh page. Before that (offline, say) a plain
        // retry is fine.
        if (prompted.current) setRetry("reload");
        else void refresh();
      }
    }
    working.current = false;
    setBioBusy(false);
  }

  useEffect(() => {
    if (!getBiometricMarker()) return;
    // Show the button straight away; if the browser turns out not to support
    // it after all, it quietly goes again.
    setBio("ready");
    let alive = true;
    (async () => {
      if (!(await biometricSupported())) {
        if (alive) setBio("off");
        return;
      }
      if (alive) await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // Coming back to the lock screen after a while: the waiting challenge may
  // have expired, so line up a new one.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        getBiometricMarker() &&
        !working.current &&
        retry === "start" &&
        !isFresh(prepared.current)
      ) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, retry]);

  const ready = bio === "ready";

  return (
    <main className="flex min-h-dvh animate-fade-in items-center justify-center bg-bg px-6 text-ink">
      <div
        className={`flex w-full flex-col items-center gap-8 transition duration-200 ease-in ${
          leaving ? "pointer-events-none -translate-y-2 opacity-0" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={44} className={busy || bioBusy || leaving ? "animate-pulse-soft" : undefined} />
          <div className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted">Locked</p>
            <p className="mt-1 font-mono text-sm text-ink">{ready ? "Unlock" : "Enter passcode"}</p>
          </div>
        </div>

        <form onSubmit={submit} className={`w-full max-w-xs ${shake ? "animate-shake" : ""}`}>
          {ready && (
            <div className="animate-unfold overflow-hidden">
              <button
                type="button"
                onClick={retry === "reload" ? () => window.location.reload() : unlockWithBiometrics}
                disabled={bioBusy || leaving}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-accent px-4 py-3 font-mono text-sm font-semibold text-[#141210] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#141210] active:scale-[0.98] disabled:opacity-40"
              >
                <Fingerprint size={18} aria-hidden="true" />
                {bioBusy
                  ? "Waiting…"
                  : retry === "reload"
                    ? "Reload to try again"
                    : retry === "resend"
                      ? "Try again"
                      : `Use ${biometricName()}`}
              </button>
              {bioMsg && (
                <p role="alert" className="mt-2 animate-fade-in text-center font-mono text-xs text-clay-strong">
                  {bioMsg}
                </p>
              )}
              <p className="py-4 text-center font-mono text-[11px] text-ink-muted">or use your passcode</p>
            </div>
          )}

          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-ink transition-colors focus:border-accent focus:outline-none"
          />
          {err && <p className="mt-2 animate-fade-in text-center text-sm text-clay-strong">{err}</p>}
          <button
            type="submit"
            disabled={busy || leaving || !passcode}
            className={`mt-4 w-full rounded-lg py-3 font-mono text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
              ready ? "border border-border-strong text-ink" : "bg-accent text-[#141210]"
            }`}
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
      </div>
    </main>
  );
}
