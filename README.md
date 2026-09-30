# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock.

A project by [Arnab Saha](https://arnabsaha.vercel.app/).

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight. Friday's tasks stay tickable until Saturday 05:59.
- A week runs **Saturday 06:00 → next Saturday 06:00** and is numbered automatically (Week 1, 2, …).
- **Only today's card is unlocked.** Every other day is locked — enforced by the server too (a direct API call gets a 409), not just the UI.
- **Task changes never touch the running week.** `/manage` edits the template; the template is read exactly once, at the next rollover.
- Each day can have any number of tasks (0–16), so one day can have 1 and another 8. Reorder with the up/down arrows next to each task.
- At rollover the finished week is closed and **emailed via Brevo** (unless notifications are off — see below): every task per day (done / missed), totals, percentage, message.
- **Timezone follows you.** The browser's timezone is saved on each visit (DST is handled by `Intl`), so moving country needs no setting.
- **Pause** (Settings → System) stops everything — no new weeks, no emails — starting at the *next* reset, not instantly; the week that's already running finishes and is emailed completely normally first. Resume is the same: requested now, takes effect at the next reset, and does not backfill the paused time as extra 0% weeks. Both require re-entering your passcode.
- **Notifications** (Settings) is a separate on/off switch for the weekly email alone — pausing already implies no email, but you can turn email off without pausing anything else.

## What changed from the first draft

- **No emoji anywhere** — task names, messages, email — by request, and to keep the free-tier database lean.
- **Leaner schema**: `week_days` merged into `week_tasks` (one row per task, day/date included directly); `weeks` no longer caches totals/percent (computed on read from the actual task rows, so there's nothing to drift out of sync); `rollover_log` folded into `weeks.emailed_at`.
- **New messages** (no emoji except 100%) — see `lib/theme.ts`.
- **Tracker → History / Trend**: paginated 10-at-a-time ("Load 10 more"), a Tasks column, and a footer row of all-time averages computed over every finalized week regardless of how many are loaded on screen.
- **Settings redesigned**: no more explanatory paragraph for the email address; Change/Remove are inline buttons next to the passcode fields, matching Streakment.
- Tooltips and visible scrollbars removed site-wide (scrolling itself still works — just no scrollbar track drawn).
- Footer only links "Arnab Saha", not the whole sentence.
- Full date + live time-with-seconds in the header (`components/live-clock.tsx`), on its own 1-second timer so the rest of the page doesn't re-render every second.

### Bugs found and fixed this round

- **The "stuck on the loading icon" issue you saw locally**: lock/unlock transitions used Next's client-side router (`router.replace`). If that soft navigation ever stalls, the old page is left showing forever with nothing to indicate why — and a stale cookie or dev-server hot-reload state makes that more likely locally than on a fresh Vercel request. Every lock-state transition (tab-lock redirect, a 401 from the API, "Lock now", unlocking) now does a hard `window.location.href` navigation instead — a full request that can't be left half-finished. The loading screen also now has a 9-second timeout with a visible Reload button, so if something *does* go wrong, there's always something to click instead of an unexplained icon.
- Bumped the database pool from 1 to 3 connections — a single connection plus Next dev's hot reload can, on some machines, leave a request with nothing to wait for indefinitely.
- **PWA icon "dark corners"**: the icon PNGs had transparent corners outside the rounded shape I'd drawn — the app itself rounded them, and then the phone tried to mask the icon *again* and revealed the transparency underneath. Fixed by generating the home-screen icons from a full-bleed, fully opaque square (`public/icon-source.svg`) with no self-rounding, and adding a proper `maskable` icon to the manifest for Android's adaptive-icon system. The in-app logo and browser-tab favicon keep their rounded look — that part was never the problem.
- `getCurrentWeek` was returning the last (already-finalized) week's data labeled as "still running" while paused, instead of signaling "paused" — found while testing the new pause feature. Now returns `null` whenever `paused` is true, and the dashboard shows a dedicated paused screen for that.
- The weekly email had no charset declaration, so emoji and the en-dash rendered as mojibake in some renderers — fixed with an explicit `<meta charset="utf-8">`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 3.4.19 · Postgres on Neon via the `postgres` package (raw SQL, no ORM — same as Streakment) · Brevo · Roboto Mono, self-hosted. Built to run on old Safari (iPhone 7 / iOS 15): no container queries, no `:has()`, no Tailwind v4.

## Run locally

1. `npm install`
2. Create a Neon project and copy the **pooled** connection string.
3. `cp .env.example .env.local` and fill it in (below).
4. Create the tables: paste `schema.sql` into Neon → **SQL Editor** and run it (or `npm run db:init` if you have `psql`). **This is a breaking schema change from the first draft** — if you already ran the old `schema.sql`, drop the old tables first (`drop table if exists weeks, task_templates, week_days, week_day_tasks, rollover_log, user_settings cascade;`) before running the new one.
5. Optional dummy data for review: `npm run db:seed` — wipes `weeks`/`task_templates` first (leaves your settings/passcode alone), never run it on a database with real history you want to keep.
6. `npm run dev` → http://localhost:3000

Other scripts: `npm run verify:dates` (prints the 6 AM / Saturday boundary cases), `npx tsx scripts/render-email-preview.ts` (writes a sample weekly email to `preview/`).

## Environment

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
| `BREVO_SENDER_EMAIL` | A sender verified in Brevo (Senders, Domains & Dedicated IPs → Senders). Verifying your own inbox is enough |
| `BREVO_SENDER_NAME` | Display name, e.g. `System` |
| `CRON_SECRET` | Any long random string; Vercel sends it as a bearer token to the cron endpoint |
| `PASSCODE_KEY` | Any long random string; encrypts the passcode so "forgot passcode" can email it back. **Set once, never change** — changing it locks out an existing passcode |

## Deploy (GitHub → Vercel Hobby + Neon free)

1. Push this folder to your GitHub repo.
2. Vercel project settings → Environment Variables → add the six above (they won't carry over automatically from a schema change).
3. Run the new `schema.sql` against production Neon (see the breaking-change note above if upgrading from the first draft).
4. Redeploy. `vercel.json` schedules `/api/cron/rollover` daily at 01:00 UTC (07:00 in Bangladesh) — Hobby allows one run per day. This is only a backup: every dashboard load also runs the rollover check, so the data is never wrong even if the cron never fires — it just makes the email arrive close to 6 AM instead of whenever you next open the app.

## Known limits

- If the app isn't paused but also isn't opened for several weeks, each skipped week is recorded as 0% (nothing was ticked) and is **not** emailed — those backfilled weeks use today's task list, since past templates aren't versioned. Pausing avoids this entirely: paused time isn't backfilled at all.
- Changing timezone mid-week shifts the 6 AM boundary from that moment on.
- The daily Vercel cron uses a fixed UTC time; in a timezone far from Bangladesh the email can arrive up to a day late (data is still correct).
- Reordering tasks is up/down buttons, not drag gestures — native HTML5 drag-and-drop doesn't work on touch devices (your iPhone), and a reliable touch-drag implementation was more than I could responsibly test in the time available this round. Happy to build it next if you'd rather have the gesture than the buttons.
