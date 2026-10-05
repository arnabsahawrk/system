"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "./switch";
import {
  askToRegister,
  biometricName,
  biometricSupported,
  clearBiometricMarker,
  errorMessage,
  finishRegistration,
  getBiometricMarker,
  isFresh,
  listDevices,
  prepareRegistration,
  removeDevice,
  setBiometricMarker,
  type PreparedRegistration,
} from "@/lib/biometric";
import type { BiometricDevice } from "@/lib/types";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Biometric unlock settings. Shown only once a passcode is set: this is a
 * second way past that passcode, never a replacement for it.
 *
 * Each device (and each browser or installed app on it) is switched on
 * separately, because the fingerprint or face never leaves the device. They
 * all appear in one list, so a lost phone can be cut off from any other
 * device.
 */
export function BiometricSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<BiometricDevice[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [marker, setMarker] = useState<string | null>(null);
  const [working, setWorking] = useState<"on" | "off" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const prepared = useRef<PreparedRegistration | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listDevices();
      setDevices(list);
      setLoadErr(null);
      const mine = getBiometricMarker();
      if (mine && !list.some((d) => d.id === mine)) {
        // Removed from another device: this one is off now too.
        clearBiometricMarker();
        setMarker(null);
      }
    } catch (e) {
      setDevices([]);
      setLoadErr(errorMessage(e, "Couldn't load biometric settings."));
    }
  }, []);

  /** Gets a one-time challenge ready ahead of the tap, so the Touch ID / Face
   * ID sheet can open straight from the tap itself (Safari insists on that). */
  const prefetch = useCallback(async () => {
    try {
      prepared.current = await prepareRegistration();
    } catch {
      prepared.current = null; // fetched on tap instead
    }
  }, []);

  useEffect(() => {
    setMarker(getBiometricMarker());
    void biometricSupported().then(setSupported);
    void load();
  }, [load]);

  useEffect(() => {
    if (!supported || marker || !devices || loadErr) return;
    if (!isFresh(prepared.current)) void prefetch();
  }, [supported, marker, devices, loadErr, prefetch]);

  async function turnOn() {
    if (working) return;
    setWorking("on");
    setErr(null);
    setMsg(null);
    try {
      // The browser prompt is the first thing this tap does whenever a
      // challenge is already waiting; otherwise it is fetched first, which
      // Safari also accepts as part of the same tap.
      const ready = prepared.current;
      prepared.current = null;
      const answer =
        ready && isFresh(ready)
          ? await askToRegister(ready)
          : await prepareRegistration().then(askToRegister);
      const id = await finishRegistration(answer);
      setBiometricMarker(id);
      setMarker(id);
      await load();
      setMsg("Turned on for this device.");
    } catch (e) {
      setErr(errorMessage(e, "Couldn't turn it on for this device."));
      void prefetch();
    } finally {
      setWorking(null);
    }
  }

  async function remove(id: string) {
    if (working) return;
    setWorking("off");
    setErr(null);
    setMsg(null);
    try {
      await removeDevice(id);
      const mine = id === getBiometricMarker();
      if (mine) {
        clearBiometricMarker();
        setMarker(null);
      }
      await load();
      setMsg(mine ? "Turned off for this device." : "Device removed.");
    } catch (e) {
      setErr(errorMessage(e, "Couldn't remove it."));
    } finally {
      setWorking(null);
    }
  }

  // Nothing to show until it's known whether this browser can do it at all.
  if (supported === null || devices === null) return null;

  const name = biometricName();
  const detail = loadErr
    ? null
    : working === "on"
      ? `Waiting for ${name}…`
      : working === "off"
        ? "Turning off…"
        : !supported
          ? "Not available here — it needs Touch ID, Face ID, a fingerprint or Windows Hello set up on this device."
          : marker
            ? `On — unlocks with ${name} on this device`
            : `Off — unlock with ${name} instead of typing`;

  return (
    <div className="flex animate-fade-in flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-ink-muted">Biometric unlock</p>
          {detail && <p className="font-mono text-[10px] text-ink-faint">{detail}</p>}
        </div>
        {!loadErr && (
          <Switch
            checked={!!marker}
            onChange={() => (marker ? remove(marker) : turnOn())}
            disabled={!!working || !supported}
            label={`Unlock with ${name} on this device`}
          />
        )}
      </div>

      {loadErr && <p className="font-mono text-xs text-clay-strong">{loadErr}</p>}

      {!loadErr && devices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex animate-fade-in items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-ink">
                  {d.label}
                  {d.id === marker && <span className="ml-2 text-[10px] text-accent">this device</span>}
                </p>
                <p className="font-mono text-[10px] text-ink-faint">Added {formatDay(d.created_at)}</p>
                <p className="font-mono text-[10px] text-ink-faint">
                  {d.last_used_at ? `Last used ${formatDay(d.last_used_at)}` : "Not used yet"}
                </p>
              </div>
              <button
                onClick={() => remove(d.id)}
                disabled={!!working}
                className="shrink-0 font-mono text-[10px] text-ink-faint transition-colors hover:text-clay-strong disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="animate-fade-in font-mono text-xs text-accent">{msg}</p>}
      {err && <p className="animate-fade-in font-mono text-xs text-clay-strong">{err}</p>}
    </div>
  );
}
