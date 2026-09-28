# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock.

A project by [Arnab Saha](https://arnabsaha.vercel.app/).

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight. Friday's tasks stay tickable until Saturday 05:59.
- A week runs **Saturday 06:00 → next Saturday 06:00** and is numbered automatically (Week 1, 2, …).
- **Only today's card is unlocked.** Every other day is locked — enforced by the server too (a direct API call gets a 409), not just the UI.
- **Task changes never touch the running week.** `/manage` edits the template; the template is read exactly once, at the next rollover.
- Each day can have any number of tasks (0–16), so one day can have 1 and another 8.
- At rollover the finished week is closed and **emailed via Brevo**: every task per day (done / missed), totals, percentage, message.
- **Timezone follows you.** The browser's timezone is saved on each visit (DST is handled by `Intl`), so moving country needs no setting.
- Progress messages (also used for colors and the email) come from `lib/theme.ts`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 3.4.19 · Postgres on Neon via the `postgres` package (raw SQL, no ORM — same as Streakment) · Brevo · Roboto Mono, self-hosted.
Built to run on old Safari (iPhone 7 / iOS 15): no container queries, no `:has()`, no Tailwind v4.

## Run locally

1. `npm install`
2. Create a Neon project and copy the **pooled** connection string.
3. `cp .env.example .env.local` and fill it in (below).
4. Create the tables: paste `schema.sql` into Neon → **SQL Editor** and run it (or `npm run db:init` if you have `psql`).
5. Optional dummy data for review: `npm run db:seed` — **wipes weeks and tasks first**, never run it on a database with real data.
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

The weekly email and the passcode recovery email go to the address stored in `user_settings.notify_email` (defaults to `arnabsahawrk@gmail.com`).

## Deploy (GitHub → Vercel Hobby + Neon free)

1. Push this folder to a new GitHub repo.
2. Vercel → **Add New Project** → import it. Name the project `arnab-system` to get `arnab-system.vercel.app`.
3. Add the six environment variables above. Run `schema.sql` on the production Neon database.
4. Deploy. `vercel.json` schedules `/api/cron/rollover` daily at 01:00 UTC (07:00 in Bangladesh) — Hobby allows one run per day.

The cron is only a backup: every dashboard load also runs the rollover check, so the data is never wrong even if the cron never fires. The cron just makes the weekly email arrive close to 6 AM instead of whenever you next open the app.

## Going live after review

Wipe the dummy data (`truncate weeks, task_templates, rollover_log restart identity cascade;` in Neon), open `/manage`, enter your real tasks per day. Because task edits only apply at the next rollover, the first week stays empty until the coming Saturday 06:00 — that is the intended behavior.

## Known limits

- If the app isn't opened for several weeks, each skipped week is recorded as 0% (nothing was ticked) and is **not** emailed. Those backfilled weeks use today's task list, since past templates aren't versioned.
- Changing timezone mid-week shifts the 6 AM boundary from that moment on.
- The daily Vercel cron uses a fixed UTC time; in a timezone far from Bangladesh the email can arrive up to a day late (data is still correct).
- `npm audit`'s dev-tool advisories were cleared by dropping Drizzle; no runtime advisories at last install.
