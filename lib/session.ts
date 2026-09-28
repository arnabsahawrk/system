import { cookies } from "next/headers";
import crypto from "crypto";
import sql from "@/lib/db";

export const PASSCODE_COOKIE = "sys_unlocked";

export interface Settings {
  timezone: string;
  notifyEmail: string;
  hasPasscode: boolean;
}

/** The passcode is encrypted, not hashed — "forgot passcode" recovers it
 * by decrypting and emailing it back, rather than only ever resetting it.
 * AES-256-GCM keyed from PASSCODE_KEY, so it's unreadable from a plain
 * database browse but not one-way. */
function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(process.env.PASSCODE_KEY ?? "").digest();
}

export function encryptPasscode(passcode: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(passcode, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptPasscode(blob: string): string {
  const data = Buffer.from(blob, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Reads the one settings row, creating it on first access. Personal
 * single-user app: there is exactly one of these, always. */
export async function getSettings(): Promise<Settings> {
  const [row] = await sql<{ timezone: string; notify_email: string; passcode_enc: string | null }[]>`
    insert into user_settings (singleton) values (true)
    on conflict (singleton) do update set updated_at = user_settings.updated_at
    returning timezone, notify_email, passcode_enc
  `;
  return {
    timezone: row?.timezone ?? "Asia/Dhaka",
    notifyEmail: row?.notify_email ?? "arnabsahawrk@gmail.com",
    hasPasscode: !!row?.passcode_enc,
  };
}

/** The one real security boundary in the app. If a passcode is set, the
 * request must carry a cookie matching the stored (encrypted) value
 * exactly — a plain string compare, no decryption needed on every
 * request. No passcode set means the app is intentionally wide open
 * (e.g. first run, before the person has chosen one). */
export async function isUnlocked(): Promise<boolean> {
  const [row] = await sql<{ passcode_enc: string | null }[]>`
    select passcode_enc from user_settings where singleton = true
  `;
  if (!row?.passcode_enc) return true;
  const cookie = (await cookies()).get(PASSCODE_COOKIE)?.value;
  return !!cookie && cookie === row.passcode_enc;
}
