# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock.

A project by [Arnab Saha](https://arnabsaha.vercel.app/) — linked from the in-app menu, not the main screen.

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight.
- A week runs **Saturday 06:00 → next Saturday 06:00**, numbered automatically.
- **Only today's card is unlocked** — enforced server-side too (a direct API call gets a 409).
- **Task changes never touch the running week** — `/manage` edits the template; only the next rollover reads it. Reorder with the up/down arrows next to each task.
- **No tasks set, for a whole week, means no week runs.** This covers both a brand-new install (nothing added yet) and an existing one where every task got deleted — in either case the system goes idle until a task exists again, and only then starts at the *next* reset. No step beyond adding a task is needed; this is not the same as the passcode-gated Pause below, though both end up idle in the same way. See "Starting fresh" below for exactly how this plays out.
- At rollover the finished week is **emailed via Brevo** (unless the Weekly email toggle is off): every task per day — including a day with none set, labeled a rest day — totals, percentage, and the week's message.
- **Timezone follows you**, synced from the browser on every visit.
- **Pause** (menu → Settings → System) stops everything starting at the *next* reset, never instantly — the week already running finishes and emails normally first. Resume is the same, and does not backfill the paused time as fake 0% weeks. Both ask for your passcode again, in their own field.
- **Weekly email** is a separate on/off switch, independent of pause.
- Progress messages and colors run red (0%) to green (100%) — `lib/theme.ts` — and only ever appear in Records and the email, not on the live Weekly card, since the week in progress isn't a verdict yet.

## Starting fresh (no data, real use from here)

All sample-data tooling (`scripts/seed.ts`, `npm run db:seed`) has been removed — this is meant for your real tasks now, not a demo.

1. Run the current `schema.sql` against an empty database.
2. Open the app. With zero tasks anywhere, the dashboard shows "Nothing set up yet" instead of empty day cards — nothing is created in the database yet, there's genuinely no week.
3. Add tasks in Manage Tasks, whenever you like — a few now, more later, no deadline.
4. The moment the first task exists, the screen updates to show the exact date Week 1 will start (the next Saturday 06:00 from that moment — never retroactively the one already underway, even if you add a task mid-week).
5. At that reset, Week 1 is created from whatever tasks exist at that moment and tracking begins normally from there.

If every task is later deleted back down to zero, the same thing happens in reverse: the week that's already running finishes out and emails normally, and then the system goes idle with the same "nothing set up" screen until a task is added again.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 3.4.19 · Postgres on Neon via the `postgres` package (raw SQL, no ORM) · Brevo · Roboto Mono, self-hosted. Built for old Safari (iPhone 7 / iOS 15).

## Run locally

1. `npm install`
2. Create a Neon project, copy the **pooled** connection string.
3. `cp .env.example .env.local` and fill it in.
4. Run `schema.sql` against a fresh database (SQL Editor, or `npm run db:init`).
5. `npm run dev` → http://localhost:3000, then add your tasks in Manage Tasks.

Dev tools that remain: `npm run verify:dates` (prints the 6 AM / Saturday boundary cases), `npx tsx scripts/render-email-preview.ts` (writes a sample weekly email to `preview/` — uses made-up data purely to render the template, doesn't touch your database).

## Environment

Six variables — `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `CRON_SECRET`, `PASSCODE_KEY`. See `.env.example`.

## Deploy (GitHub → Vercel Hobby + Neon free)

Push, set the six env vars, run `schema.sql`, redeploy. `vercel.json` schedules the backup rollover cron daily at 01:00 UTC — the dashboard itself also runs the same rollover check on every load, so the data is never wrong even if the cron never fires; the cron only makes the email arrive close to 6 AM instead of whenever the app is next opened.

## Known limits

- Reordering tasks is up/down buttons, not drag gestures (native HTML5 drag doesn't work on touch devices).
- The Records table scrolls horizontally on narrow screens to show every column — no visible scrollbar by design, but it is a swipe, not obvious at a glance.
- The daily Vercel cron uses a fixed UTC time; in a timezone far from Bangladesh the email can arrive up to a day late (data is still correct either way).
- Changing timezone mid-week shifts the 6 AM boundary from that moment on.
