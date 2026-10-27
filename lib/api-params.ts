/** A week number from a URL: a positive whole number, or null. */
export function parseWeekNumber(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,7}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed uuid. Checked before an id from a URL or a body
 * reaches Postgres, which would answer a malformed one with a 500. */
export function isUuid(raw: unknown): raw is string {
  return typeof raw === "string" && UUID.test(raw);
}
