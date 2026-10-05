import type { BiometricDevice } from "@/lib/types";

/** Browser side of biometric unlock (WebAuthn): Touch ID, Face ID, Android
 *  fingerprint, Windows Hello. The server half is /api/webauthn.
 *
 *  Two things shape everything in here, both about Safari:
 *
 *  1. Safari only shows the Touch ID / Face ID sheet in answer to a tap.
 *     The challenge is therefore fetched *before* the tap, and the prompt
 *     is started as the very first thing the tap handler does. Fetching
 *     inside the tap also works (WebKit carries a tap through fetch for
 *     ten seconds) and is kept as the fallback.
 *  2. Credentials are tied to the device and the site. A browser can't be
 *     asked "do you have one?", so each device remembers the ID of its own
 *     credential in localStorage; no ID means this device never set it up.
 *     The installed home-screen app and Safari keep separate storage, so
 *     each is switched on separately, and shows up as its own entry. */

const MARKER_KEY = "sys_bio_cred";

/** The server keeps a challenge for five minutes; stop using one a minute early. */
const FRESH_MS = 4 * 60 * 1000;

// ---------- this device's marker ----------

export function getBiometricMarker(): string | null {
  try {
    return localStorage.getItem(MARKER_KEY);
  } catch {
    return null;
  }
}

export function setBiometricMarker(id: string): void {
  try {
    localStorage.setItem(MARKER_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export function clearBiometricMarker(): void {
  try {
    localStorage.removeItem(MARKER_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ---------- errors ----------

export type BiometricFailure =
  | "cancelled"
  | "unsupported"
  | "unknown-credential"
  | "network"
  | "failed";

/** Always carries a message that is safe to show as is. */
export class BiometricError extends Error {
  kind: BiometricFailure;
  constructor(kind: BiometricFailure, message: string) {
    super(message);
    this.name = "BiometricError";
    this.kind = kind;
  }
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** What to show for anything thrown by this module. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof BiometricError || err instanceof ApiError) return err.message;
  return fallback;
}

/** Turns what the browser throws into something worth showing. NotAllowed is
 *  the browser's answer to a dismissed sheet, a timeout and a missing tap alike. */
function fromBrowser(err: unknown, task: "unlock" | "register"): BiometricError {
  if (err instanceof BiometricError) return err;
  const name = typeof err === "object" && err !== null ? (err as { name?: string }).name : "";
  switch (name) {
    case "NotAllowedError":
    case "AbortError":
      return new BiometricError(
        "cancelled",
        task === "unlock"
          ? "Cancelled or timed out. Tap to try again, or enter the passcode."
          : "Cancelled or timed out. Tap to try again.",
      );
    case "NotSupportedError":
    case "SecurityError":
      return new BiometricError("unsupported", "This browser can't use biometrics here.");
    default:
      return new BiometricError(
        "failed",
        task === "unlock"
          ? "Biometrics didn't work. Enter the passcode instead."
          : "Couldn't turn it on for this device.",
      );
  }
}

// ---------- device ----------

/** Can this browser use the sensor built into the device? */
export async function biometricSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.isSecureContext) return false;
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** What this device calls it, for button text. */
export function biometricName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "Touch ID / Face ID";
  if (/Macintosh/.test(ua)) return navigator.maxTouchPoints > 1 ? "Touch ID / Face ID" : "Touch ID";
  if (/Windows/.test(ua)) return "Windows Hello";
  if (/Android/.test(ua)) return "fingerprint";
  return "biometrics";
}

/** How a device shows up in the list of devices, e.g. "iPhone (installed app)". */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const os = /iPhone|iPod/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || touchMac
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Device";
  const installed =
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const browser = installed
    ? "installed app"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "";
  return browser ? `${os} (${browser})` : os;
}

// ---------- base64url ----------

function toB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- server calls ----------

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/webauthn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BiometricError("network", "Couldn't reach the app. Check the connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, typeof data?.error === "string" ? data.error : "Request failed");
  }
  return data as T;
}

/** A challenge the server has issued, already converted for the browser. */
export interface Prepared<T> {
  options: T;
  at: number;
}

/** Stale challenges are refetched inside the tap instead. */
export function isFresh(prepared: Prepared<unknown> | null): boolean {
  return !!prepared && Date.now() - prepared.at < FRESH_MS;
}

// ---------- unlocking ----------

interface UnlockOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: { id: string; transports?: string[] }[];
}

export type PreparedUnlock = Prepared<PublicKeyCredentialRequestOptions>;

/** Step 1, ahead of the tap: ask the server for a one-time challenge. */
export async function prepareUnlock(credentialId: string): Promise<PreparedUnlock> {
  let json: UnlockOptionsJSON;
  try {
    json = await call<UnlockOptionsJSON>({ action: "unlock-options", credentialId });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new BiometricError(
        "unknown-credential",
        "Biometric unlock was removed for this device. Use the passcode.",
      );
    }
    throw err instanceof ApiError
      ? new BiometricError("failed", "Biometrics aren't available right now. Use the passcode.")
      : err;
  }
  return {
    at: Date.now(),
    options: {
      challenge: fromB64url(json.challenge),
      timeout: json.timeout,
      rpId: json.rpId,
      userVerification: json.userVerification,
      allowCredentials: json.allowCredentials?.map((c) => ({
        type: "public-key" as const,
        id: fromB64url(c.id),
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    },
  };
}

export interface UnlockAnswer {
  id: string;
  rawId: string;
  type: string;
  authenticatorAttachment?: string;
  clientExtensionResults: unknown;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
}

/** Step 2, the tap: show the Touch ID / Face ID sheet. Nothing is awaited
 *  before the browser call, on purpose: it has to be the first thing that
 *  happens inside the tap. */
export async function askForUnlock(prepared: PreparedUnlock): Promise<UnlockAnswer> {
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({ publicKey: prepared.options });
  } catch (err) {
    throw fromBrowser(err, "unlock");
  }
  if (!(credential instanceof PublicKeyCredential)) throw fromBrowser(null, "unlock");

  const r = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      authenticatorData: toB64url(r.authenticatorData),
      signature: toB64url(r.signature),
      userHandle: r.userHandle ? toB64url(r.userHandle) : undefined,
    },
  };
}

/** Step 3: the server checks the signature and, if it holds up, sets the
 *  same unlock cookie a correct passcode does. */
export async function finishUnlock(answer: UnlockAnswer): Promise<void> {
  try {
    await call({ action: "unlock-verify", response: answer });
  } catch (err) {
    throw err instanceof ApiError
      ? new BiometricError("failed", "Couldn't verify it. Enter the passcode instead.")
      : err;
  }
}

// ---------- adding this device ----------

interface RegistrationOptionsJSON {
  rp: { name: string; id?: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
}

export type PreparedRegistration = Prepared<PublicKeyCredentialCreationOptions>;

export async function prepareRegistration(): Promise<PreparedRegistration> {
  const json = await call<RegistrationOptionsJSON>({ action: "register-options" });
  return {
    at: Date.now(),
    options: {
      rp: json.rp,
      user: {
        id: fromB64url(json.user.id),
        name: json.user.name,
        displayName: json.user.displayName,
      },
      challenge: fromB64url(json.challenge),
      pubKeyCredParams: json.pubKeyCredParams,
      timeout: json.timeout,
      attestation: json.attestation,
      authenticatorSelection: json.authenticatorSelection,
    },
  };
}

export interface RegistrationAnswer {
  id: string;
  rawId: string;
  type: string;
  authenticatorAttachment?: string;
  clientExtensionResults: unknown;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

/** The tap that adds this device. Same rule as askForUnlock: the browser
 *  call comes first. */
export async function askToRegister(prepared: PreparedRegistration): Promise<RegistrationAnswer> {
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey: prepared.options });
  } catch (err) {
    throw fromBrowser(err, "register");
  }
  if (!(credential instanceof PublicKeyCredential)) throw fromBrowser(null, "register");

  const r = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      attestationObject: toB64url(r.attestationObject),
      // Older Safari doesn't have getTransports(); the server defaults it.
      transports: typeof r.getTransports === "function" ? r.getTransports() : undefined,
    },
  };
}

/** The server checks the new credential and stores it. Returns its ID. */
export async function finishRegistration(answer: RegistrationAnswer): Promise<string> {
  const data = await call<{ credentialId: string }>({
    action: "register-verify",
    response: answer,
    label: deviceLabel(),
  });
  return data.credentialId;
}

// ---------- the list of devices ----------

export async function listDevices(): Promise<BiometricDevice[]> {
  const data = await call<{ devices: BiometricDevice[] }>({ action: "list" });
  return data.devices;
}

export async function removeDevice(id: string): Promise<void> {
  await call({ action: "remove", credentialId: id });
}
