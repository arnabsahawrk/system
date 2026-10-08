# System — plan and status

## This round: a livelier day, a deeper look back

Everything below was built from the plan agreed for this round, except backup/export (declined) — plus confetti for a finished day (requested).

- **The tick** (`components/task-row.tsx`, styles in `app/globals.css`): real `<input type="checkbox">` wearing a drawn box — check mark strokes in, box pops, name struck through by a sweeping line (`box-decoration-break: clone` so a wrapped name gets one per line). 44px rows. Footer emoji replaced with the check icon.
- **Confetti** (`lib/confetti-engine.ts` physics, `lib/confetti.ts` canvas): one burst from the box you ticked when it completes the day; a second, wider puff 150ms later. One full-screen click-through canvas that exists only while pieces are in flight. Throttled to one celebration per 1.2s; off under reduced motion.
- **Optimistic ticks, no re-fetch** (`components/dashboard.tsx`, `lib/week-state.ts`): ticks apply instantly (totals and percentage recomputed locally) and each request carries the exact state wanted, so it is idempotent. A failed save shows a notice that clears itself and re-syncs from the server once the burst settles. A slow older response can never paint over a newer tick (load sequence + in-flight counters).
- **One round trip on load**: `/api/week/current` now returns `{ week, settings }`.
- **Today-first phone layout** (`components/week-view.tsx`, `components/collapse.tsx`): <640px is Today → Weekly (rings are buttons) → the other days as accordion rows; ≥640px the original grid. `Collapse` animates real heights (old Safari can't animate CSS grid rows).
- **Pace line + task chains** (`lib/pace.ts`, `lib/weeks.ts getChainBases`): arithmetic follows the *rounded* displayed percentage exactly (brute-force checked for every total up to 300 and every common target). Chains are computed in one SQL pass per load, today's tasks only.
- **Records 2.0** (`components/records-list.tsx`, `components/week-strip.tsx`): seven-cell strip per week, stacked on phones / one line from 1024px, tap-to-expand post-mortem (`GET /api/week/[weekNumber]`), optional note (`PUT /api/week/[weekNumber]/note`). The live week's strip is built from the same day cards shown above it.
- **Week notes** (`lib/notes.ts`): own table, `week_notes`, so a note never touches task rows. Created by the app on first use *and* in `schema.sql` section 6. If it can't be reached the Records list still loads, just without notes.
- **Insights** (`lib/insights.ts` pure maths, `lib/insights-db.ts` queries, `components/insights-view.tsx`, `/insights`): streaks, bests, weekday shape + trend, task consistency, tick clock. Nothing stored.
- **Week-closed sheet + email** (`lib/verdict.ts`, `components/verdict-sheet.tsx`, `lib/email.ts`): same numbers in both places. Only the week that *just* ended qualifies, once per device.
- **Instant open**: loading skeleton instead of a pulsing logo; `public/sw.js` + `public/offline.html` (static files only, never data); registered in production only.
- Housekeeping: shared `addDaysToDateKey` moved to `lib/date.ts`; one `goToUnlock()` helper (`lib/nav.ts`) instead of repeated hard redirects, so lint is warning-free; Postgres "already exists" notices silenced in `lib/db.ts`; an empty day now carries its real date (was the week's first date).

## How the numbers are defined

So the pace line, streaks, Insights, the sheet and the email can never disagree (`lib/goals.ts`, `lib/stats.ts`):

- **On target** = 80% or more of the *rounded* percentage, for a day or a week.
- **Streaks** run over days that have tasks. Rest days are skipped. A day still open neither breaks nor extends a streak; once it is perfect (or ≥80%) it counts.
- **Task consistency** uses closed days in the last 8 weeks only (future days are not misses) and ranks a task only once it has 3 closed occurrences.
- **A chain** is consecutive *scheduled* occurrences (matched by name) that were fully done, ending at the last closed one.
- **Clock**: days are measured from the 06:00 start, so a tick at 00:30 belongs to the day before and sorts after 11 PM. "Closed after midnight" = the day's last tick fell in the 06:00 grace window.

## Verified this round

- `npm run verify:logic`: 26 checks — pace maths (brute force against `Math.round`), streak and run helpers, insights on a hand-built three-week dataset, clock/bucket edges at exactly 06:00 and 05:59, confetti physics.
- Data layer against real Postgres 16 with four seeded weeks whose figures were worked out by hand first: chains (7 and 1), streaks, bests, weekday shape, task ranking, clock, verdicts for weeks 1 and 3, notes (trim, collapse, clear, validate, 160-char limit, finished-weeks-only), idempotent ticks, the 05:59 / 06:00 lock boundary, and the email with and without a verdict — 17 checks.
- Headless Chromium against a production build with the clock pinned (375×667 phone and 1280×900 desktop, Asia/Dhaka): first-open sheet; today-first order; pace line before/after a tick; chain badges; confetti appears, paints, and removes itself; persistence across reload; no confetti on a card that loads complete or on un-ticking; Records expand/collapse as an accordion, post-mortem contents, note save/clear/persist; rest-of-week rows read-only and un-tickable; strip taps; desktop grid and locked-card dimming; Insights on both layouts; service worker registers, caches static files only, and the offline page appears with the server down.
- Edge scenarios: every new endpoint 401s while locked and validates its input (400/404/409); a dropped save shows the notice and re-syncs; rapid tick/untick and triple-tap bursts end with screen and server agreeing; Friday with the target out of reach; a rest day as today; the real Saturday 06:00 rollover (week finalized, next week created, sheet shows a −26 drop with no streak chip); an empty install.
- `tsc`, `eslint` (0 errors, 0 warnings), `next build` clean.
- Bugs found and fixed along the way: entrance animations were holding `opacity: 1` and overriding the dimming on locked cards (caught in a screenshot, now a regression check); `border-border/70` is invalid because the border token is rgba, which made Records borders far too bright; streak tile labels wrapped unevenly on a 375px screen; a leftover `grid-cols-24` class that Tailwind doesn't have.

## Not verified

- Real iOS Safari 15 / an actual iPhone 7: everything was checked in Chromium emulating a 375px touch viewport. Features were chosen from what iOS 15 supports (no `:has()`, `canvas.roundRect`, `Array.at`, etc.), but real-device smoothness of the confetti and the entrance animations is untested.
- Live Brevo send, Neon, Vercel deploy and cron — no key or network for these in the sandbox. The email template was rendered and viewed, and the send path runs up to the provider call.
- The service worker inside an installed iOS home-screen app.
- Reduced-motion behaviour was reasoned from the CSS and the engine's early return, not tested with the OS setting.

## Next (still parked)

1. True drag-and-drop for task reordering — arrows are still the safer choice on touch.
2. The 80% target as a setting (it's one constant in `lib/goals.ts`).
3. Evening "still open" reminders — iOS 15 can't receive web push, so this would be email-only, and the app is deliberately quiet.
