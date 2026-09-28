# System — plan and status

Kept in the repo so any future session (or a new chat) can resume from files instead of from memory.

## Architecture

- **Time model** (`lib/date.ts`): every day/week decision is a pure function of `(now, timeZone)` after subtracting 6 hours. No timers, no stored "current day" flag.
- **Data** (`schema.sql`): `user_settings` (singleton), `task_templates` (the live plan), `weeks`, `week_days`, `week_day_tasks` (a frozen copy of the plan per week), `rollover_log` (email de-dupe).
- **Rollover** (`lib/rollover.ts`): `ensureCurrentWeek(now)` runs on every dashboard load and from the daily cron. Row-locks the latest week, then loops finalize → create until it reaches the real current week. Emails only weeks that ended in the last 48 h.
- **Lock** (`lib/session.ts`, `app/api/passcode`, `lib/tab-lock.ts`): same design as Streakment — AES-256-GCM encrypted passcode, server-checked cookie, per-tab sessionStorage flag, `pagehide` beacon locks on close, "forgot passcode" emails it back after 3 misses.
- **Email** (`lib/email.ts`): Brevo REST call, HTML + plain-text weekly summary, UTF-8 declared.

## Verified (in a sandbox, against local Postgres 16)

- 6 AM / Saturday boundary: 10 cases via `npm run verify:dates`.
- Multi-week gap: 3 stale weeks caught up in order, honest 0%, no emails for stale weeks, landed on the real current week.
- Locked-day tick rejected (409); passcode set / wrong / right / cookie-less access (401).
- `tsc --noEmit` and `next build` clean.
- Bugs found and fixed by that testing: Postgres `date` parsed as JS `Date` (broke week comparison); email had no charset (emoji became mojibake); auto-lock fired on in-app link navigation.

## Not verified

- Live Brevo send (no key or network in the sandbox) — request follows Brevo's documented `v3/smtp/email` shape.
- Neon itself (local Postgres 16 was used), Vercel deploy, cron firing.
- The UI in a real browser, and on iPhone 7 / Safari 15 specifically.
- Task-edit deferral end to end through `/manage` (true by construction: only `createWeek` reads templates).
- `npm run lint`.

## Next

1. **Data display beyond week table + chart:** monthly roll-up, yearly GitHub-style heatmap (same style as Streakment), streak of weeks ≥ 60 %, best week, per-task consistency ("Exercise 18/24 weeks"), color-banded weekly history.
2. **Service worker** for an offline app shell (manifest, icons and iOS meta already exist).
3. Rename / reorder UI in `/manage` (the rename API already exists).
4. Optional: a second email trigger via GitHub Actions if the fixed daily cron time becomes a problem while travelling.
