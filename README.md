# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock, and Touch ID / Face ID can open it for you on a device you've switched it on for.

A project by [Arnab Saha](https://arnabsaha.vercel.app/) — linked from the in-app menu, not the main screen.

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight.
- A week runs **Saturday 06:00 → next Saturday 06:00**, numbered automatically.
- **Only today's card is unlocked** — enforced server-side too (a direct API call gets a 409). A tick sends the exact state it wants (`{ "completed": true }`), so repeating it, or ticking from a second device with a stale screen, can never flip a task the wrong way.
- **Task changes never touch the running week** — `/manage` edits the template; only the next rollover reads it. Reorder with the up/down arrows next to each task.
- **No tasks set, for a whole week, means no week runs.** This covers both a brand-new install (nothing added yet) and an existing one where every task got deleted — in either case the system goes idle until a task exists again, and only then starts at the *next* reset. No step beyond adding a task is needed; this is not the same as the passcode-gated Pause below, though both end up idle in the same way. See "Starting fresh" below for exactly how this plays out.
- At rollover the finished week is **emailed via Brevo** (unless the Weekly email toggle is off): every task per day — including a day with none set, labeled a rest day — totals, percentage, and the week's message.
- **Timezone follows you**, synced from the browser on every visit.
- **Pause** (menu → Settings → System) stops everything starting at the *next* reset, never instantly — the week already running finishes and emails normally first. Resume is the same, and does not backfill the paused time as fake 0% weeks. Both ask for your passcode again, in their own field.
- **Weekly email** is a separate on/off switch, independent of pause.
- Progress messages and colors run red (0%) to green (100%) — `lib/theme.ts` — and only ever appear in Records, the week-closed sheet and the email, not on the live Weekly card, since the week in progress isn't a verdict yet. (The live card's pace line is plain arithmetic, not a verdict.)

## What's in the app

**The day**
- **Ticking is a small event.** A drawn checkbox strokes in its check mark, pops, and the task name is struck through by a line that sweeps across it. Rows are 44px tall. Ticks are applied on screen instantly and are *not* followed by a re-fetch; the screen re-syncs from the server only if a save fails.
- **Finish a day and it celebrates** — a burst of confetti from the box you just ticked, a band of light across the card header, a "done" badge. Only on the moment you finish it (never on a card that loads already complete, never on un-ticking), and skipped entirely if your device asks for reduced motion.
- **Task chains.** Today's tasks show `×6` when that task has been done on its last 6 scheduled days in a row (days it isn't scheduled on are skipped, so a Mon/Wed/Fri habit chains Mon → Wed → Fri). It counts closed days only; today's tick adds one live.
- **Pace line.** The Weekly card says how many of the ticks that can still happen you need to reach 80% ("Need 9 of the 12 open tasks to reach 80%"), or that it's out of reach ("Best possible now: 76%"). It follows the displayed, rounded percentage exactly, and the target lives in `lib/goals.ts`.
- **Today first on phones.** Below 640px the order is Today → Weekly (its seven rings are buttons) → the rest of the week as one-line rows that open read-only. From 640px up it's the full grid.

**Looking back**
- **Records.** Each week is a seven-cell strip (Sat → Fri) on the same red-to-green scale — a rest day is neutral, never red — so stacked rows *are* the yearly heatmap. Tap a finished week for a post-mortem listing exactly what was missed, and an optional one-line note, "What got in the way?" (saved on its own; a week's tasks are never touched). No sideways swiping: rows stack on phones and run on one line from 1024px.
- **Insights** (menu → Insights). Streaks (perfect days, days at 80%+, weeks at 80%+), personal bests, your week's shape by weekday, each task's consistency over the last 8 weeks (weakest first, with a link to Manage Tasks), and when you tick — typical time, plus how many days the last tick landed after midnight. Everything is recomputed from the task rows each time the page opens; rest days are skipped and a day still open can never break a streak.
- **The week-closed sheet.** The first time the app is opened after a week rolls over, a sheet shows how it ended: the result, the change since the week before, the run of 80%+ weeks, the task that's been slipping, and the note field. Seen once per device (`localStorage`); a perfect week gets confetti.
- **The weekly email** now carries the same comparison: the change vs last week (also in the subject), the streak, a seven-cell day strip made of coloured table cells (email clients strip SVG), and the weakest task. If that comparison can't be worked out the email goes out exactly as before.

**Feel**
- **Instant open.** The dashboard appears as a skeleton at once and fills in; `/api/week/current` returns the settings alongside the week (one round trip instead of two). A small service worker (`public/sw.js`) keeps only static files — hashed JS/CSS/fonts, icons, an offline page — and shows a calm "you're offline" page when the app can't be reached. It never touches `/api/*` and never caches a page or any JSON, so no task data sits on the device outside the passcode lock, and a tick can't be queued offline and then rejected by the 06:00 rule.
- Everything animates with transform/opacity only (no animation libraries) and collapses to instant under `prefers-reduced-motion`.

## Starting fresh (no data, real use from here)

All sample-data tooling (`scripts/seed.ts`, `npm run db:seed`) has been removed — this is meant for your real tasks now, not a demo.

1. Run the current `schema.sql` against an empty database.
2. Open the app. With zero tasks anywhere, the dashboard shows "Nothing set up yet" instead of empty day cards — nothing is created in the database yet, there's genuinely no week.
3. Add tasks in Manage Tasks, whenever you like — a few now, more later, no deadline.
4. The moment the first task exists, the screen updates to show the exact date Week 1 will start (the next Saturday 06:00 from that moment — never retroactively the one already underway, even if you add a task mid-week).
5. At that reset, Week 1 is created from whatever tasks exist at that moment and tracking begins normally from there.

If every task is later deleted back down to zero, the same thing happens in reverse: the week that's already running finishes out and emails normally, and then the system goes idle with the same "nothing set up" screen until a task is added again.

## Biometric unlock

Once a passcode is set, each device can also open the app with Touch ID, Face ID, an Android fingerprint or Windows Hello (menu → Settings → Biometric unlock). It sits on top of the passcode and never replaces it: the server checks a signed answer from the device before it unlocks anything, then sets the same cookie a correct passcode does. The passcode keeps working everywhere, and removing it removes every biometric device too.

- Each device, browser or installed app is switched on separately and listed in Settings, so a lost phone can be removed from any other device. New devices can only be added from inside the app, once unlocked.
- Safari only shows the prompt in answer to a tap, so on iPhone the lock screen has a button rather than opening it by itself. Needs iOS 14 or newer.
- A device's fingerprint or face is checked by the device. Anyone whose fingerprint or face is saved on it, or who knows its own passcode, can pass that check.
- It is tied to the exact web address the app is served from; if the domain changes, switch it on again.
- Code: `lib/webauthn.ts` and `app/api/webauthn/route.ts` (server), `lib/biometric.ts` (browser), `components/biometric-settings.tsx` and `app/unlock/page.tsx` (screens).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 3.4.19 · Postgres on Neon via the `postgres` package (raw SQL, no ORM) · Brevo · Roboto Mono, self-hosted. Built for old Safari (iPhone 7 / iOS 15).

## Run locally

1. `npm install`
2. Create a Neon project, copy the **pooled** connection string.
3. `cp .env.example .env.local` and fill it in.
4. Run `schema.sql` against a fresh database (SQL Editor, or `npm run db:init`).
5. `npm run dev` → http://localhost:3000, then add your tasks in Manage Tasks.

Dev tools that remain: `npm run verify:dates` (prints the 6 AM / Saturday boundary cases), `npm run verify:logic` (the pure maths behind the pace line, streaks, insights and confetti — no database needed), `npx tsx scripts/render-email-preview.ts` (writes a sample weekly email to `preview/` — uses made-up data purely to render the template, doesn't touch your database).

## Environment

Six variables — `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `CRON_SECRET`, `PASSCODE_KEY`. See `.env.example`.

## Deploy (GitHub → Vercel Hobby + Neon free)

Push, set the six env vars, run `schema.sql`, redeploy. Already running before biometric unlock existed? Run just section 5 of `schema.sql` in the Neon SQL editor; every statement in it is safe to repeat. The week notes table (section 6) needs nothing from you on an existing database — the app creates it itself the first time it's used; section 6 is there for fresh installs and for reference. `vercel.json` schedules the backup rollover cron daily at 01:00 UTC — the dashboard itself also runs the same rollover check on every load, so the data is never wrong even if the cron never fires; the cron only makes the email arrive close to 6 AM instead of whenever the app is next opened.

## Known limits

- Reordering tasks is up/down buttons, not drag gestures (native HTML5 drag doesn't work on touch devices).
- Insights need history to say much: streaks and bests appear after the first closed day, the weekday shape and task ranking firm up after about 4 weeks, and a task isn't ranked until it has shown up on 3 closed days.
- Ticking needs a connection. There is deliberately no offline queue: a tick synced after 06:00 would hit the only-today rule and be refused.
- There's no haptic feedback — iOS Safari doesn't expose vibration.
- Notes can only be added to a *finished* week.
- The daily Vercel cron uses a fixed UTC time; in a timezone far from Bangladesh the email can arrive up to a day late (data is still correct either way).
- Changing timezone mid-week shifts the 6 AM boundary from that moment on.
