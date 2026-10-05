# System — plan and status

## This round (likely final)

- **Sidebar**: now opens from the right. Footer redesigned — centered, top border, "Arnab Saha" bright by default with the underline only on hover (previously the reverse).
- **Records**: added a heatmap-style color legend ("Less [swatches] More") in the footer, under Message, sampled from the same `getProgressColor` scale every row uses.
- **Color order fixed app-wide**: `lib/theme.ts` now runs red (0%) → clay → olive → green (100%), replacing the old red→green→gold arc. This propagates everywhere automatically (rings, rows, the email) since it's all one function.
- **New messages**, no emoji except 100% — `lib/theme.ts`. Confirmed: still used in the email (the user asked for this explicitly after noticing a stray "will messages only live in Records" note of mine) — only removed from the live Weekly card, not the email.
- **Weekly card**: message pill removed; rebalanced with a larger percentage and more padding rather than left as a gap.
- **Unlock page**: kept the user's own copy tweaks ("Enter passcode") but reverted `router.push` back to the hard `window.location.href` navigation — their edit had left the comment above it (explaining why it's a hard nav) untouched while changing the code to contradict it, which reads as accidental rather than deliberate. Flagged this clearly rather than silently doing either thing.
- **Cleanup for the real-data launch**: `scripts/seed.ts` and its `db:seed` script deleted. Icon source SVGs moved from `public/` (where they were being needlessly served) to `design/`. `favicon-32.png` was sitting unused — rather than delete it, wired it into `app/layout.tsx` as a real fallback, since older Safari has patchy SVG-favicon support.
- **Email**: "No tasks this day" reworded to "Rest day — no tasks set" in both the HTML and plain-text versions, per the user's request that an empty day be explicitly called out as a rest day, not look like a gap.

## The big one: idle system when there are no tasks

Generalizes what was bootstrap-only logic into a standing rule, per the user's own framing ("this way the first week edge case also validates"):

- `user_settings.pause_reason`: `'manual' | 'no_tasks' | null`. Manual pause still requires an explicit passcode-gated resume. `'no_tasks'` clears itself automatically the next time a boundary is reached with at least one task template in existence — no user action beyond adding the task.
- `lib/rollover.ts`'s while-loop now checks task-template count at two points: before creating *any* new week (auto-pauses with reason `no_tasks` if none exist), and while already paused (auto-resumes if reason is `no_tasks` and a task now exists).
- The original bootstrap path (`pending_start_date`, for the very first week before any week has ever existed) is unchanged and still needed — there's no `latest` row to anchor the while-loop on until one exists.
- Dashboard: `NotStartedState` now covers three cases with one component — never started (no date yet), a task just added (shows the exact computed date), and an existing system that emptied back out (no date shown, since that path doesn't use `pending_start_date` — it reuses the existing week's date as its anchor instead).

### A real bug this surfaced

`loadWeek()` (which calls `/api/week/current`, the one endpoint that actually runs the rollover check) could change `pendingStartDate`/`paused`/`pauseReason` as a side effect, but the dashboard's local `settings` state was never refreshed afterward — it only ever reflected whatever `app/page.tsx` had read at the start of that server render. Caught by actually adding a task through the real `/manage` UI and watching the dashboard still say "Nothing set up yet" instead of the computed date. Fixed by re-fetching `/api/settings` right after every `loadWeek()` call.

## Verified this round

- Full lifecycle via direct calls against local Postgres: empty DB → add task → `pending_start_date` computed correctly → boundary crossed → Week 1 created at the right date → task deleted mid-week → next boundary auto-pauses (`reason: no_tasks`, week finalized, no new week) → task re-added → next boundary auto-resumes with no backfilled weeks. Hand-verified every resulting date against the 7-day boundary math.
- Browser-verified (Playwright, rebuilding before every server start this time): sidebar position and footer (including the hover-only underline, screenshotted mid-hover), Weekly card with no message, Records legend (had to scroll the table's own container both ways to find it — it's there and correct), the empty/pending/live dashboard states, and the settings-refresh bug above, live.
- Email: regenerated the preview with a deliberately empty day — "Rest day — no tasks set" renders correctly in both HTML and the text fallback; subject/message pill use the new text; colors confirmed landing on green at high percentages instead of the old gold.
- `tsc`, `eslint` (0 errors), `next build` all clean against the final schema.

## Not verified

- Live Brevo send, Neon, Vercel deploy/cron — unchanged limitation, no key/network for these in the sandbox.
- Manual pause/resume through the UI buttons specifically *this* round (the underlying engine is the same code path just verified for the no-tasks case, and was click-tested two rounds ago; not re-screenshotted this time given how much else needed covering).
- Real mobile touch behavior for the Records table's horizontal scroll.

## Next (still parked, nothing new added)

1. Yearly heatmap, week streaks, best-week stat.
2. Offline service worker (app-shell only).
3. True drag-and-drop for task reordering.
