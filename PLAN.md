# System — plan and status

Kept in the repo so any future session can resume from files instead of from memory.

## Architecture (v2)

- **Time model** (`lib/date.ts`): unchanged — every day/week decision is a pure function of `(now, timeZone)` after subtracting 6 hours.
- **Data** (`schema.sql`): `user_settings` (singleton — now also holds `notifications_enabled`, `paused`, `pending_action`), `task_templates` (the live plan, no emoji), `weeks` (no cached totals), `week_tasks` (one row per task per day, day/date inline — merged from the old week_days + week_day_tasks).
- **Rollover** (`lib/rollover.ts`): `ensureCurrentWeek(now)` — same catch-up loop as before, now also branching on `paused`/`pending_action` each iteration: pause takes effect (no new week created) the moment the running week's boundary is reached; resume creates exactly one fresh week at the real current boundary, skipping the idle gap rather than backfilling it.
- **History pagination** (`lib/weeks.ts` `getHistoryPage`): 10 finalized weeks per page, newest-first, `before=<weekNumber>` to page further back; a separate aggregate query computes all-time stats (week count, average tasks/done/percent) over every finalized week regardless of page size.
- **Lock**: unchanged design (Streakment-style encrypted passcode, server cookie, per-tab sessionStorage, `pagehide` beacon) — now using hard `window.location` navigation instead of the Next router for every lock-state transition, and a `/api/pause` route reusing the same `verifyPasscode` check for the new pause/resume/notifications-adjacent settings.

## Verified this round (sandbox, local Postgres 16)

- `tsc --noEmit`, `eslint .` (0 errors), `next build` all clean.
- Paginated history: page 1 + `before=` page 2 return correct, non-overlapping weeks; all-time stats match hand totals.
- Pause: wrong passcode rejected (401); correct passcode accepted; `pendingAction` set without touching the live week; crossing the boundary finalizes+would-email the running week and creates **no** new week; `paused` flips to true.
- Resume: requested while paused; crossing a boundary creates **exactly one** new week dated at the real current boundary (confirmed via direct DB inspection — no backfilled weeks for the paused gap).
- Found and fixed mid-testing: `getCurrentWeek` wasn't checking `paused` at all and returned the last finalized week mislabeled as live — now returns `null` and the dashboard shows a dedicated paused screen.
- PWA icon corner bug reproduced and fixed (transparent corners under a second OS-level mask); new full-bleed + maskable icons generated and visually checked.

## Not verified

- Live Brevo send, Neon itself, Vercel deploy/cron — same as before, no key/network for these in the sandbox.
- The full HTTP-level pause/resume flow through a running server + browser cookies specifically (verified instead via direct calls to the same library functions the routes call — the sandbox's long-running dev server kept getting killed between tool calls partway through this round, so I fell back to the more reliable direct-call test, which exercises identical logic minus the HTTP/cookie layer).
- The reorder-by-buttons UI and the paginated "Load 10 more" button, in an actual browser.
- `notifications_enabled = false` actually suppressing a send end-to-end (the gating is a single `if` before the send call — low risk, but not click-tested).

## Next

1. **True drag-and-drop** for task reordering, if the up/down buttons feel like a downgrade — needs a touch-compatible (Pointer Events, not HTML5 dragstart) implementation, deliberately not attempted this round given the testing constraints above.
2. **More data views**: yearly heatmap (Streakment-style), streak of weeks ≥ some threshold, best week, per-task consistency across weeks.
3. Service worker for an offline app shell.
