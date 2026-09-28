-- ============================================================
--  SYSTEM — schema
--  A personal daily-accomplishment tracker.
--
--  Personal, single-user app. No accounts, no login — the whole
--  database belongs to the one person running it. Run once against
--  a fresh Neon database:  npm run db:init
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  1. Settings. A single row — `singleton` can only ever be
--     `true`, and a primary key can only ever hold one value of
--     it, so there is exactly one row, always.
-- ------------------------------------------------------------

create table if not exists user_settings (
  singleton     boolean primary key default true check (singleton),
  -- Optional app passcode, reversibly encrypted (not hashed) with
  -- PASSCODE_KEY, so a forgotten passcode can be decrypted and
  -- emailed back rather than only ever reset. Null = off.
  passcode_enc  text,
  -- IANA zone, e.g. "Asia/Dhaka". Refreshed from the browser on every
  -- visit (see /api/settings) so it follows the person, not the device.
  timezone      text not null default 'Asia/Dhaka',
  notify_email  text not null default 'arnabsahawrk@gmail.com',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into user_settings (singleton) values (true) on conflict do nothing;

-- ------------------------------------------------------------
--  2. Task templates — the CURRENT plan. Editable any time; a
--     day's tasks in an already-running week are a frozen copy
--     (see week_day_tasks below), so editing here never touches
--     this week — only the next rollover reads this table.
-- ------------------------------------------------------------

create table if not exists task_templates (
  id          uuid primary key default gen_random_uuid(),
  day_index   smallint not null, -- 0=Saturday .. 6=Friday
  name        text not null,
  emoji       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint task_day_index_range check (day_index between 0 and 6),
  constraint task_name_len check (char_length(name) between 1 and 60)
);
create index if not exists task_templates_day_idx on task_templates(day_index, sort_order);

-- ------------------------------------------------------------
--  3. Weeks. One row per app-week (Saturday 06:00 -> the following
--     Saturday 06:00). completed_tasks/total_tasks/percent are
--     kept in sync on every tick rather than computed on read, so
--     a finalized week's numbers never shift under it later.
-- ------------------------------------------------------------

create table if not exists weeks (
  id              uuid primary key default gen_random_uuid(),
  week_number     integer not null,
  start_date      date not null, -- the Saturday
  total_tasks     integer not null default 0,
  completed_tasks integer not null default 0,
  percent         integer not null default 0,
  finalized       boolean not null default false,
  emailed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint weeks_number_unique unique (week_number),
  constraint weeks_start_unique unique (start_date)
);
create index if not exists weeks_finalized_idx on weeks(finalized, start_date desc);

-- ------------------------------------------------------------
--  4. Week days — the 7 calendar dates belonging to a week.
-- ------------------------------------------------------------

create table if not exists week_days (
  id        uuid primary key default gen_random_uuid(),
  week_id   uuid not null references weeks(id) on delete cascade,
  day_index smallint not null,
  date      date not null,

  constraint week_day_index_range check (day_index between 0 and 6),
  constraint week_days_unique unique (week_id, day_index)
);

-- ------------------------------------------------------------
--  5. Week day tasks — a frozen copy of that day's tasks, taken
--     from task_templates at rollover. Frozen on purpose: renaming
--     or removing a template task later must not rewrite history.
-- ------------------------------------------------------------

create table if not exists week_day_tasks (
  id           uuid primary key default gen_random_uuid(),
  week_day_id  uuid not null references week_days(id) on delete cascade,
  name         text not null,
  emoji        text,
  sort_order   integer not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz
);
create index if not exists week_day_tasks_day_idx on week_day_tasks(week_day_id, sort_order);

-- ------------------------------------------------------------
--  6. Rollover ledger — guards against sending the same weekly
--     email twice if a lazy check and the cron race each other.
-- ------------------------------------------------------------

create table if not exists rollover_log (
  week_id  uuid primary key references weeks(id) on delete cascade,
  ran_at   timestamptz not null default now()
);
