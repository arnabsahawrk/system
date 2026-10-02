# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock.

A project by [Arnab Saha](https://arnabsaha.vercel.app/) — linked from the in-app menu, not the main screen.

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight.
- A week runs **Saturday 06:00 → next Saturday 06:00**, numbered automatically.
- **Only today's card is unlocked** — enforced server-side too (a direct API call gets a 409).
- **Task changes never touch the running week** — `/manage` edits the template; only the next rollover reads it. Reorder with the up/down arrows next to each task.
- At rollover the finished week is **emailed via Brevo** (unless the Weekly email toggle is off): every task, totals, percentage, message.
- **Timezone follows you**, synced from the browser on every visit.
- **Pause** (menu → Settings → System) stops everything starting at the *next* reset, never instantly — the week already running finishes and emails normally first. Resume is the same, and does not backfill the paused time as fake 0% weeks. Both ask for your passcode again, in their own field.
- **Weekly email** is a separate on/off switch, independent of pause.

## What changed this round

- **Chart/Trend removed entirely** — deleted `components/tracker-chart.tsx` and all references. The old History/Trend tabs are gone; what's left is a plain **Records** heading (styled like Everyday/Weekly) followed directly by the table — no tabs.
- **Navigation moved to a sidebar.** The three header icons are now a single menu button that opens a slide-in drawer: Lock App (only shown when a passcode is set), Manage Tasks, Settings, and the "A project by Arnab Saha" credit at the bottom (only "Arnab Saha" is a link, in the accent green) — removed from the main page entirely, since it now lives in the drawer.
- **Settings reordered and reworked**: Weekly email first (with a redrawn toggle — see bug below), System/pause second, now with its *own* passcode field instead of borrowing the one from the passcode section, App passcode last.
- **Smoothness pass**: page content fades in on load, the settings sheet slides/fades in and out instead of popping, buttons give a little press feedback, a wrong passcode now shakes the input instead of just showing red text.
- **Icons**: see the Windows fix below. Nothing changed about the design itself — same target mark, same colors — only which variant gets used where.
- **Seed data** now generates **40 historical weeks** (randomized, gently trending) instead of 6, specifically so pagination has enough to page through — the old seed never had enough weeks to make "Load 10 more" appear at all.

### Bugs found and fixed this round

- **The toggle switch's ball overflowing its track**: the old geometry mixed an odd track width with an arbitrary-value transform or thereabouts and didn't actually guarantee the ball stayed inside at both ends. Rebuilt with round, verified numbers (48×28 track, 20×20 ball, 4px margin on every side in both states) plus `overflow-hidden` on the track as a second line of defense, and confirmed visually in a real browser this time, not just by reading the CSS.
- **PWA icon square on Windows, rounded on mobile** — this turned out to be correct, documented behavior rather than a bug to patch over: Android and iOS both apply their own rounding/masking to a PWA icon, but Windows applies none at all and just shows the file as-is. The icon file that's full-bleed and un-rounded (right for Android/iOS, since they do the rounding for you) was the exact same file Windows was showing plainly square. Fixed by splitting the manifest's `"any"`-purpose icons (what Windows actually uses) into their own pre-rounded version, while the `"maskable"` icon and the iOS apple-touch-icon stay full-bleed, since those two platforms still need to do their own masking on top.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 3.4.19 · Postgres on Neon via the `postgres` package (raw SQL, no ORM) · Brevo · Roboto Mono, self-hosted. Built for old Safari (iPhone 7 / iOS 15).

## Run locally

1. `npm install`
2. Create a Neon project, copy the **pooled** connection string.
3. `cp .env.example .env.local` and fill it in.
4. Run `schema.sql` against a fresh database (SQL Editor, or `npm run db:init`).
5. `npm run db:seed` for 40 weeks of sample data to actually see pagination, History averages, etc. — wipes `weeks`/`task_templates` first, leaves your settings alone.
6. `npm run dev` → http://localhost:3000

## Environment

Same six variables as before — `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `CRON_SECRET`, `PASSCODE_KEY`. See `.env.example`.

## Deploy (GitHub → Vercel Hobby + Neon free)

Same as before — push, set the six env vars, run `schema.sql` if it's changed, redeploy. `vercel.json` schedules the backup rollover cron daily at 01:00 UTC.

## Known limits

- Reordering tasks is still up/down buttons, not drag gestures (native HTML5 drag doesn't work on touch devices).
- The Records table scrolls horizontally on narrow screens to show every column — no visible scrollbar by design, but it is a swipe, not something that's obvious at a glance. Worth a follow-up if it's not intuitive in practice.
- Same cron/timezone/backfill notes as before (see PLAN.md).
