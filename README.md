# System

A personal daily-accomplishment tracker. One person, no accounts — the passcode is the only lock, and Touch ID / Face ID can open it for you on a device you've switched it on for.

A project by [Arnab Saha](https://arnabsaha.vercel.app/) — linked from the in-app menu, not the main screen.

## The rules it enforces

- The **day and the week both flip at 06:00 local time**, not midnight.
- A week runs **Saturday 06:00 → next Saturday 06:00**, numbered automatically.
- **Only today's card is unlocked** — enforced server-side too (a direct API call gets a 409). A tick sends the exact state it wants (`{ "completed": true }`), so repeating it, or ticking from a second device with a stale screen, can never flip a task the wrong way.
- **Task changes never touch the running week.** `/manage` edits the plan for the weeks to come; only the next rollover reads it. A task is added once, to a list, and then switched on for the days it belongs to (see *Manage tasks* below).
- **No task on any day, for a whole week, means no week runs.** A task that is in the list but on no day doesn't count. This covers both a brand-new install (nothing set up yet) and an existing one where every task got deleted or taken off every day — in either case the system goes idle until a task is on a day again, and only then starts at the *next* reset. No step beyond that is needed; this is not the same as the passcode-gated Pause below, though both end up idle in the same way. See "Starting fresh" below for exactly how this plays out.
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
- **Pace line.** The Weekly card says what finishing today's tasks would add to the week — "Finish 2 more today to reach 34%" — and, once today is done, where the week stands. It uses the same rounding as the big number, so the moment the last task is ticked the card shows exactly that figure. There is no weekly target to hit.
- **Today first on phones.** Below 640px the order is Today → Weekly (its seven rings are buttons) → the rest of the week as one-line rows that open read-only. An opened day is faded and locked, just like the cards on a wide screen. From 640px up it's the full grid.

**Planning**
- **Manage tasks** (menu → Manage Tasks). Two views of one plan.
  - *Tasks* is the list. Type a task once (the add field is at the bottom), open it, and tap the days it belongs to: it appears on those days' cards, and tapping a day again takes it off that card. "Every day" / "Clear all" do all seven at once. Reorder or delete a task here (delete asks first).
  - *Week* shows what each day will contain. Reorder a day's tasks or take one off that day — the same as switching the day off in the task. No adding here.
  - Both headings show counts ("7 tasks", "27 tasks a week"; "1 task" when there is one).
  - Because a task is only ever typed once, "Work" and "Work-" can't become two tasks: a name that differs only by case, spacing or punctuation is refused as "the same task". Up to 60 tasks in the list, 16 on a day.
  - Changes appear on screen at once and are sent in order; if one fails a notice says so and the screen re-syncs from the server.

**Looking back**
- **Records.** Each week is a seven-cell strip (Sat → Fri) on the same red-to-green scale — a rest day is neutral, never red — so stacked rows *are* the yearly heatmap. Tap a finished week for a post-mortem listing exactly what was missed, and a **Week note** (up to 200 characters). A note is written once and can be changed once, with the pencil; after that it's final (and there is no way to delete it). It's saved on its own — a week's tasks are never touched. No sideways swiping: rows stack on phones and run on one line from 1024px.
- **Insights** (menu → Insights). Everything since your first day, in plain terms: overall completion and perfect days; streaks (perfect days — every task done — and active days — at least one done); every finished week as a coloured square, with your average, best and latest week; how much you finish on each day of the week; how often you finish each task (weakest first, with a link to Manage tasks); and what time of day you tick. Rest days are skipped, and a day still open can never break a streak. Everything is recomputed from the task rows each time the page opens.
- **The week-closed sheet.** The first time the app is opened after a week rolls over, a sheet shows how it ended: the result, the change since the week before, whether it set a new best week, the task that has slipped most overall, and the note field. Seen once per device (`localStorage`); a perfect week gets confetti.
- **The weekly email** carries the same comparison: the change vs last week (also in the subject), "New best week" when it applies, a seven-cell day strip made of coloured table cells (email clients strip SVG), and the weakest task. If that comparison can't be worked out the email goes out exactly as before.

**Feel**
- **Instant open.** The dashboard appears as a skeleton at once and fills in; Manage tasks and Insights show their own skeleton the moment you tap them (`app/*/loading.tsx`). Each skeleton has the same cards, order and breakpoints as the page it stands in for. `/api/week/current` returns the settings alongside the week (one round trip instead of two). A small service worker (`public/sw.js`) keeps only static files — hashed JS/CSS/fonts, icons, an offline page — and shows a calm "you're offline" page when the app can't be reached. It never touches `/api/*` and never caches a page or any JSON, so no task data sits on the device outside the passcode lock, and a tick can't be queued offline and then rejected by the 06:00 rule.
- Everything animates with transform/opacity only (no animation libraries) and collapses to instant under `prefers-reduced-motion`. There are no tooltips anywhere.
- **The menu** (top right) holds Lock App, Insights, Manage Tasks, System Philosophy (your Notion page, in a new tab), Settings, and the credit line.

## Starting fresh (no data, real use from here)

1. Run the current `schema.sql` against an empty database.
2. Open the app. With no task on any day, the dashboard shows "Nothing set up yet" instead of empty day cards — nothing is created in the database yet, there's genuinely no week.
3. Add tasks in Manage Tasks and switch each one on for its days, whenever you like — a few now, more later, no deadline.
4. The moment the first task is on a day, the screen updates to show the exact date Week 1 will start (the next Saturday 06:00 from that moment — never retroactively the one already underway, even if you add a task mid-week).
5. At that reset, Week 1 is created from the plan as it stands at that moment and tracking begins normally from there.

If every task is later deleted (or taken off every day), the same thing happens in reverse: the week that's already running finishes out and emails normally, and then the system goes idle with the same "nothing set up" screen until a task is on a day again.

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
5. `npm run dev` → http://localhost:3000, then add your tasks in Manage Tasks and switch each on for its days.

Dev tools that remain: `npm run verify:dates` (prints the 6 AM / Saturday boundary cases), `npm run verify:logic` (the pure maths behind the pace line, task names, streaks, insights and confetti — no database needed), `npx tsx scripts/render-email-preview.ts` (writes a sample weekly email to `preview/` — uses made-up data purely to render the template, doesn't touch your database).

## Environment

Six variables — `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `CRON_SECRET`, `PASSCODE_KEY`. See `.env.example`.

## Deploy (GitHub → Vercel Hobby + Neon free)

Push, set the six env vars, run `schema.sql`, redeploy.

**Already running before the task list existed?** There is nothing to run. The first time the new version opens, it moves your tasks into the new list-and-days layout by itself, in one transaction (`lib/task-library.ts`): every task and every day is kept, in the same order, and names that only differ by case, spacing or punctuation ("Work", "work", "Work-") become one task under the spelling it met first. It also brings the notes table up to date (200 characters, the one-change rule). Weeks, ticks and history are not touched. It is a one-way move — the previous version of the app can't read the new layout — so deploy forward rather than rolling back.

Already running before biometric unlock existed? Run just section 5 of `schema.sql` in the Neon SQL editor; every statement in it is safe to repeat. `vercel.json` schedules the backup rollover cron daily at 01:00 UTC — the dashboard itself also runs the same rollover check on every load, so the data is never wrong even if the cron never fires; the cron only makes the email arrive close to 6 AM instead of whenever the app is next opened.

## Known limits

- Reordering tasks is up/down buttons, not drag gestures (native HTML5 drag doesn't work on touch devices).
- A task can't be renamed: to fix a typo, add the right name, switch on its days, and delete the old one. (History and chains match tasks by name, so a rename would split them.)
- Insights need history to say much: streaks and totals appear after the first closed day, the weekday picture firms up after about 4 weeks, and a task isn't ranked until it has had 3 finished days.
- Ticking needs a connection. There is deliberately no offline queue: a tick synced after 06:00 would hit the only-today rule and be refused.
- There's no haptic feedback — iOS Safari doesn't expose vibration.
- Week notes can only be added to a *finished* week, can be changed once, and can't be deleted.
- The daily Vercel cron uses a fixed UTC time; in a timezone far from Bangladesh the email can arrive up to a day late (data is still correct either way).
- Changing timezone mid-week shifts the 6 AM boundary from that moment on.
