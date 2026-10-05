import sql from "@/lib/db";

/** Server side of biometric unlock (WebAuthn): Touch ID, Face ID, Android
 * fingerprint, Windows Hello.
 *
 * It is a second way to get past the passcode, not a replacement. A
 * successful biometric check ends in exactly the same place a correct
 * passcode does: the server sets the unlock cookie (see /api/webauthn).
 * Everything the browser sends is verified here against a public key stored
 * in the database — the browser's word alone is never enough. */

/** Platform authenticators only: the sensor built into the device. */
export const TRANSPORTS: string[] = ["internal"];

/** ES256 covers Apple, Android and Mac; RS256 is what Windows Hello uses. */
export const ALGORITHMS = [-7, -257];

export const RP_NAME = "System";

export type ChallengeKind = "register" | "unlock";

/** The site this request came from. Browsers bind every credential to the
 * domain it was created on, so a credential made on one domain can only
 * ever be used there. */
export function relyingParty(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  return { rpID: url.hostname, origin: url.origin };
}

/** Postgres "undefined_table": the biometric SQL in schema.sql hasn't been
 * run yet. */
export function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

// ---------- challenges ----------

/** A challenge lives five minutes and is deleted the moment it is used.
 * Leftovers (a lock screen opened and never used) are swept up here, on the
 * next one issued, so the table never holds more than a few short-lived rows. */
export async function storeChallenge(kind: ChallengeKind, challenge: string): Promise<void> {
  await sql`delete from webauthn_challenges where created_at < now() - interval '15 minutes'`;
  await sql`insert into webauthn_challenges (challenge, kind) values (${challenge}, ${kind})`;
}

/** True exactly once per challenge, and only while it is still fresh. */
export async function consumeChallenge(kind: ChallengeKind, challenge: string): Promise<boolean> {
  const rows = await sql`
    delete from webauthn_challenges
    where challenge = ${challenge}
      and kind = ${kind}
      and created_at > now() - interval '5 minutes'
    returning challenge
  `;
  return rows.length > 0;
}

// ---------- credentials ----------

export interface StoredCredential {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
}

export async function findCredential(id: string): Promise<StoredCredential | null> {
  const [row] = await sql<{ id: string; public_key: Buffer; counter: string }[]>`
    select id, public_key, counter from webauthn_credentials where id = ${id}
  `;
  if (!row) return null;
  return {
    id: row.id,
    publicKey: new Uint8Array(row.public_key),
    counter: Number(row.counter),
  };
}

export async function saveCredential(c: {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  label: string;
}): Promise<void> {
  const key = Buffer.from(c.publicKey);
  await sql`
    insert into webauthn_credentials (id, public_key, counter, label)
    values (${c.id}, ${key}, ${c.counter}, ${c.label})
    on conflict (id) do update
      set public_key = excluded.public_key,
          counter = excluded.counter,
          label = excluded.label
  `;
}

export async function markCredentialUsed(id: string, counter: number): Promise<void> {
  await sql`
    update webauthn_credentials
    set counter = ${counter}, last_used_at = now()
    where id = ${id}
  `;
}

export async function listCredentials() {
  const rows = await sql<
    { id: string; label: string; created_at: Date; last_used_at: Date | null }[]
  >`
    select id, label, created_at, last_used_at
    from webauthn_credentials
    order by created_at asc
  `;
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    created_at: new Date(r.created_at).toISOString(),
    last_used_at: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  }));
}

export async function removeCredential(id: string): Promise<void> {
  await sql`delete from webauthn_credentials where id = ${id}`;
}

/** Used when the passcode is removed. Quietly does nothing if the biometric
 * tables were never created, so removing a passcode can never fail because
 * of a feature that isn't set up. */
export async function removeAllCredentials(): Promise<void> {
  try {
    await sql`delete from webauthn_credentials`;
    await sql`delete from webauthn_challenges`;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
}

/** A device label comes from the browser, so it is trimmed and bounded
 * before it goes anywhere near the database. */
export function cleanLabel(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  return cleaned || "This device";
}
