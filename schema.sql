-- ============================================================
--  SYSTEM — schema (v2)
--  A personal daily-accomplishment tracker.
--
--  Personal, single-user app. No accounts, no login. Run once
--  against a fresh Neon database:  npm run db:init
--
--  v2 changes from the first draft, all for a leaner free-tier
--  database: dropped the emoji columns (plain text only); merged
--  week_days into week_tasks (date/day_index live on the task row
--  directly, one fewer table and one fewer join); dropped the
--  cached total/completed/percent columns on `weeks` (computed on
--  read from the actual task rows instead, so there's no counter
--  that can drift out of sync); dropped the separate rollover_log
--  table (weeks.emailed_at now doubles as that claim).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  1. Settings. A single row — `singleton` can only ever be
--     `true`, and a primary key can only hold one value of it,
--     so there is exactly one row, always.
-- ------------------------------------------------------------

create table if not exists user_settings (
  singleton              boolean primary key default true check (singleton),
  passcode_enc           text,
  timezone               text not null default 'Asia/Dhaka',
  notify_email           text not null default 'arnabsahawrk@gmail.com',
  notifications_enabled  boolean not null default true,
  -- Pause: takes effect only at a rollover boundary, never instantly — see
  -- lib/rollover.ts. `paused` is the current state; `pending_action` is
  -- what should happen at the *next* boundary crossed, or null for "stay
  -- as-is". Toggling back and forth before a boundary just edits this
  -- pending intent; nothing actually changes until a boundary arrives.
  paused                 boolean not null default false,
  pending_action         text check (pending_action in ('pause', 'resume')),
  -- Why `paused` is true: 'manual' only clears via an explicit resume
  -- (passcode required, see /api/pause); 'no_tasks' clears itself the next
  -- time a boundary is reached and at least one task template exists — no
  -- action needed beyond adding a task back in /manage. Emptying the task
  -- list to 0 for a whole week is what sets 'no_tasks' automatically.
  pause_reason           text check (pause_reason in ('manual', 'no_tasks')),
  -- Set once, the first time ever a task is added while no week has ever
  -- existed — the Saturday the very first week is allowed to start on, so
  -- adding a task mid-week can never backdate week 1 into a week that's
  -- partly already gone. Cleared once that first week is actually created.
  pending_start_date     date,
  updated_at             timestamptz not null default now()
);

insert into user_settings (singleton) values (true) on conflict do nothing;

-- ------------------------------------------------------------
--  2. Task templates — the CURRENT plan. Editable any time; a
--     day's tasks in an already-running week are a frozen copy
--     (see week_tasks below), so editing here never touches this
--     week — only the next rollover reads this table.
-- ------------------------------------------------------------

create table if not exists task_templates (
  id          uuid primary key default gen_random_uuid(),
  day_index   smallint not null, -- 0=Saturday .. 6=Friday
  name        text not null,
  sort_order  integer not null default 0,

  constraint task_day_index_range check (day_index between 0 and 6),
  constraint task_name_len check (char_length(name) between 1 and 60)
);
create index if not exists task_templates_day_idx on task_templates(day_index, sort_order);

-- ------------------------------------------------------------
--  3. Weeks. One row per app-week (Saturday 06:00 -> the following
--     Saturday 06:00). No cached totals — see finalize/read queries
--     in lib/weeks.ts and lib/rollover.ts, which aggregate
--     week_tasks directly.
-- ------------------------------------------------------------

create table if not exists weeks (
  id          uuid primary key default gen_random_uuid(),
  week_number integer not null,
  start_date  date not null, -- the Saturday
  finalized   boolean not null default false,
  -- Doubles as the "did we already email this week" claim: an email is
  -- only sent by the request that successfully flips this from null with
  -- an atomic conditional update, so a racing cron and lazy-check can't
  -- both send it.
  emailed_at  timestamptz,
  created_at  timestamptz not null default now(),

  constraint weeks_number_unique unique (week_number),
  constraint weeks_start_unique unique (start_date)
);
create index if not exists weeks_finalized_idx on weeks(finalized, start_date desc);

-- ------------------------------------------------------------
--  4. Week tasks — one row per task per day of a week, holding
--     both which day it belongs to and whether it's done. A
--     frozen copy of that day's template tasks, taken at rollover
--     — frozen on purpose: renaming or removing a template task
--     later must not rewrite history.
-- ------------------------------------------------------------

create table if not exists week_tasks (
  id           uuid primary key default gen_random_uuid(),
  week_id      uuid not null references weeks(id) on delete cascade,
  day_index    smallint not null,
  date         date not null,
  name         text not null,
  sort_order   integer not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz,

  constraint week_task_day_index_range check (day_index between 0 and 6)
);
create index if not exists week_tasks_week_idx on week_tasks(week_id, day_index, sort_order);
-- Powers "today's tasks" and the day-lock check (lib/weeks.ts toggleTask)
-- without needing week_id at all.
create index if not exists week_tasks_date_idx on week_tasks(date);
