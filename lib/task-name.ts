/**
 * Task rules shared by the server (which enforces them) and the Manage Tasks
 * screen (which only displays them). Pure: no database, no DOM.
 */

export const MAX_NAME_LEN = 60;
export const MAX_TASKS_PER_DAY = 16;
export const MAX_LIBRARY_TASKS = 60;

/** One line, single spaces, nothing at the edges. */
export function cleanTaskName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * What makes two names "the same task": only their letters and digits, in any
 * case. "Work", "work", "Work-" and "W ork" all share one key, so a stray
 * hyphen or space can never create a second task. A name with no letters or
 * digits at all (an emoji, say) falls back to the lower-cased name itself.
 */
export function taskKey(name: string): string {
  const core = name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
  return core || cleanTaskName(name).toLowerCase();
}

/** "1 task", "2 tasks", "0 tasks". */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The order a list ends up in when asked to follow `wanted`: the ids in
 * `wanted` first (once each, and only if they still exist), then any the
 * request didn't mention, in their current order. A stale or partial request
 * from a second device can reorder what it knows about but never drops
 * anything.
 */
export function mergeOrder(wanted: string[], current: string[]): string[] {
  const known = new Set(current);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of wanted) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of current) if (!seen.has(id)) out.push(id);
  return out;
}
