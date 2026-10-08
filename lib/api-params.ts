/** A week number from a URL: a positive whole number, or null. */
export function parseWeekNumber(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,7}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}
