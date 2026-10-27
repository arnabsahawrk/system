# System — plan and status

## This round: tasks you define once, an overall look back

Built from the two last requests (the Manage Tasks redesign and the Insights / notes / skeleton round).

- **Manage tasks, rebuilt** (`components/manage-tasks.tsx`, `lib/task-templates.ts`, `lib/task-library.ts`, `lib/task-name.ts`): a *Tasks* list (type a task once, add field at the bottom, open it to switch days on and off, reorder, delete with a confirm) and a *Week* of seven day cards (reorder, take a task off a day, no adding). Counts and singular/plural everywhere. Changes show at once and are sent through one ordered queue; a failure shows a notice and re-syncs.
- **Duplicate tasks can't happen.** `tasks` holds each name once; `name_key` (letters and digits only, any case) is unique, so "Work" / "work" / "Work-" are one task. A day is a row in `task_templates (task_id, day_index, sort_order)`. Limits: 60 tasks, 16 per day.
- **Existing data moves itself** (`ensureTaskLibrary`): old one-row-per-day-and-name templates become the list plus day rows, in one transaction under an advisory lock, on first use. Look-alike names merge under the first spelling met. Weeks and history are never touched. The weekly rollover now copies a week from the plan in a single statement, renumbering each day's order 0..n-1.
- **Pace line = today's growth.** "Finish 2 more today to reach 34%": ticks so far plus what is still open today. No weekly target, no 80%.
- **The 80% idea is gone everywhere** — pace line, Insights, week-closed sheet, email. In their place: a "New best week" badge, and the weakest task measured over every finished week.
- **Insights, overall and plain** (`lib/insights.ts`, `components/insights-view.tsx`): overall completion, weeks and perfect days; perfect-day and active-day streaks; every finished week as a square with average / best / latest; weekday bars with strongest and weakest day; per-task consistency; time of day and after-midnight days. All of history, no 4- or 8-week windows.
- **Week note** (`components/note-editor.tsx`, `lib/notes.ts`): renamed "Week note", 200 characters, a pencil opens it, one change allowed, then final (`week_notes.edited`, enforced by the server). A first note still saves when you leave the field; the one change only saves on purpose.
- **Phone: opened days are faded and locked**, like the wide cards (lock on the row too).
- **Skeletons everywhere**: dashboard (now including Records, exact phone and wide shapes), Manage tasks, Insights, the biometric row; `loading.tsx` for Manage and Insights so they appear the instant the menu item is tapped.
- **Sidebar**: "System Philosophy" above Settings, opening your Notion page in a new tab.
- Housekeeping: no tooltips anywhere (the last `title` attributes removed), dead `tracker-table.tsx` deleted, hard redirects use `goToUnlock()`.

## How the numbers are defined

So the pace line, streaks, Insights, the sheet and the email can never disagree (`lib/stats.ts`, `lib/pace.ts`, `lib/insights.ts`):

- **Percentages** are always `Math.round` of the share, for a day, a week or the whole history.
- **Pace**: target = round((ticked so far + still open today) ÷ the week's tasks). After the last tick the week's percentage is exactly that figure.
- **Streaks** run over days that have tasks; rest days are skipped. *Perfect* = every task done; *active* = at least one done. A day still open neither breaks nor extends a streak; once it qualifies it counts.
- **Overall** and the weekday bars use closed days only (future days are not misses). The week average is weighted by task count, not a mean of means.
- **Task consistency** uses every closed day and ranks a task only once it has 3 closed occurrences. Tasks are matched by name.
- **A chain** is consecutive *scheduled* occurrences (matched by name) that were fully done, ending at the last closed one.
- **Clock**: days are measured from the 06:00 start, so a tick at 00:30 belongs to the day before and sorts after 11 PM. "After midnight" = the day's last tick fell between midnight and 06:00.
- **A note** is written once and changed once; clearing is not possible, so it can't be used to start over.

## Verified this round

- `npm run verify:logic`: 33 checks — pace (including 400 random weeks, and a week with ticks on a later day, always landing exactly on the target), task names (look-alike spellings, other scripts), list ordering, the new Insights maths on a hand-built three-week dataset and on 60 weeks, clock/bucket edges at exactly 06:00 and 05:59, confetti physics.
- Data layer against real Postgres 16, fresh install (21 checks): names and look-alikes (including three simultaneous adds of one name), days on/off and the 16-per-day and 60-per-list limits (a refused change leaves nothing half-done), ordering from a stale screen, delete, the first reset after a task exists, a week copied from the plan, a mid-week plan change leaving the running week alone, verdict, history, all-time insights, the note rules, "new best week", and pause/resume with tasks on no day.
- The same against an **old-layout database** (25 old template rows, 50 task rows, an old notes table), upgraded by four server processes starting at once: tasks merged and ordered as expected, old table gone, history identical by checksum, notes table brought to 200 characters with the old note kept, and the next week built from the upgraded plan.
- Headless Chromium against a production build, phone 375×667 and desktop 1280×900, nine seeded weeks: the week-closed sheet, today-first layout, pace line before and after the last tick, confetti appears and removes itself, persistence across reload, sidebar order and link (new tab, `noopener`), the note through add → pencil → one change → final (and a hand-made third write refused with 409), a note saved when its field is left, Manage tasks end to end (add, open, pick days, day card and picker staying in step, look-alike refused, reorder in the list and in a day, Every day / Clear all, delete with confirm, matches the server after reload), Insights, opened days faded and locked with the clock on a Wednesday, and the loading skeletons captured mid-load on a slow network.
- `tsc`, `eslint` (0 errors, 0 warnings), `next build` clean.
- Bugs found and fixed along the way: the add field's placeholder showed a literal `\u2026`; the note hint said "Saved" instead of "You can change this once" if the pencil was tapped within two seconds of saving; the pace formula assumed no later day could have ticks (a timezone change can do that) — it now can't go wrong.

## Not verified

- Real iOS Safari 15 / an actual iPhone 7: everything was checked in Chromium emulating a 375px touch viewport.
- The upgrade on your actual Neon database (tested on local Postgres 16 with a copy of the old layout), and the advisory lock through Neon's pooler (transaction-level locks are the pooler-safe kind, but this was not run there).
- Live Brevo send, Vercel deploy and cron. The email template was rendered (`preview/email-preview.html`); the send path runs up to the provider call.
- The service worker inside an installed iOS home-screen app.
- Reduced-motion behaviour was reasoned from the CSS and the engine's early return, not tested with the OS setting.

## Next (still parked)

1. True drag-and-drop for task reordering — arrows are still the safer choice on touch.
2. Renaming a task (history and chains match by name, so this needs a stable id on `week_tasks` first).
3. Evening "still open" reminders — iOS 15 can't receive web push, so this would be email-only, and the app is deliberately quiet.
