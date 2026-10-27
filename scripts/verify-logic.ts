/**
 * Pure-logic checks for the numbers and motion the newer features rely on:
 * the pace line, task names, streaks, weeks, weekday shape, task ranking, the
 * tick clock, and the confetti physics. No database or browser needed —
 * every function under test takes plain values.
 *
 *   npm run verify:logic
 */
import assert from "node:assert/strict";
import { computeInsights } from "../lib/insights";
import type { DayRow, TaskRow, TickRow } from "../lib/insights";
import { computePace, paceText } from "../lib/pace";
import { aggregatePercent, formatClock, median, percentOf, rankTasks, runStats } from "../lib/stats";
import { addDaysToDateKey, diffDateKeys, getLocalMinutesOfDay } from "../lib/date";
import { CONFETTI_COLORS, DRAG, createBurst, particleAlpha, stepParticles } from "../lib/confetti-engine";
import { cleanTaskName, mergeOrder, plural, taskKey } from "../lib/task-name";
import { applyTick } from "../lib/week-state";
import type { CurrentWeek, DayIndex } from "../lib/types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    throw err;
  }
}

// --------------------------------------------------------------------------
console.log("pace");

/** A week laid out as [done, total] for each day, Saturday to Friday. */
function weekOf(days: [number, number][]): CurrentWeek {
  let id = 0;
  let done = 0;
  let total = 0;
  const built = days.map(([d, t], dayIndex) => {
    done += d;
    total += t;
    return {
      dayIndex: dayIndex as DayIndex,
      dateKey: addDaysToDateKey("2026-10-03", dayIndex),
      tasks: Array.from({ length: t }, (_, i) => ({ id: `t${id++}`, name: "t", completed: i < d })),
    };
  });
  return {
    weekNumber: 1,
    startDateKey: "2026-10-03",
    completed: done,
    total,
    percent: percentOf(done, total),
    finalized: false,
    days: built,
  };
}

test("computePace: what finishing today adds, on top of the days already settled", () => {
  // Sat 4/5 and Sun 5/5 are over (9 done). Mon is today, 1 of 3 ticked. 35 tasks in the week.
  const week = weekOf([[4, 5], [5, 5], [1, 3], [0, 5], [0, 5], [0, 6], [0, 6]]);
  assert.equal(week.total, 35);
  assert.deepEqual(computePace(week, 2), { kind: "open", open: 2, total: 3, target: 34 }); // (9 + 3) / 35 = 34.3%
  assert.equal(paceText(computePace(week, 2)), "Finish 2 more today to reach 34%");
});

test("paceText: every wording", () => {
  const untouched = weekOf([[4, 5], [5, 5], [0, 3], [0, 5], [0, 5], [0, 6], [0, 6]]);
  assert.equal(paceText(computePace(untouched, 2)), "Finish all 3 today to reach 34%");

  const single = weekOf([[4, 5], [5, 5], [0, 1], [0, 5], [0, 5], [0, 6], [0, 6]]);
  assert.equal(paceText(computePace(single, 2)), "Finish today's task to reach 30%"); // 10 / 33

  const done = weekOf([[4, 5], [5, 5], [3, 3], [0, 5], [0, 5], [0, 6], [0, 6]]);
  assert.deepEqual(computePace(done, 2), { kind: "done", percent: 34 });
  assert.equal(paceText(computePace(done, 2)), "Today's done \u2014 the week is at 34%");

  const rest = weekOf([[4, 5], [5, 5], [0, 0], [0, 5], [0, 5], [0, 6], [0, 6]]);
  assert.deepEqual(computePace(rest, 2), { kind: "rest", percent: 28 }); // 9 / 32
  assert.equal(paceText(computePace(rest, 2)), "Rest day \u2014 the week holds at 28%");

  assert.deepEqual(computePace(weekOf([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]), 0), { kind: "none" });
  assert.equal(paceText({ kind: "none" }), null);
});

test("the target is exactly the week's percentage once today's last task is ticked", () => {
  const rand = seeded(42);
  let checked = 0;
  for (let n = 0; n < 400; n++) {
    const days = Array.from({ length: 7 }, () => {
      const total = Math.floor(rand() * 9);
      return [Math.floor(rand() * (total + 1)), total] as [number, number];
    });
    const todayIndex = Math.floor(rand() * 7);
    const week = weekOf(days);
    const pace = computePace(week, todayIndex);
    if (pace.kind !== "open") continue;

    let ticked = week;
    for (const t of week.days[todayIndex]!.tasks) if (!t.completed) ticked = applyTick(ticked, t.id, true);
    assert.equal(ticked.percent, pace.target, `case ${n}`);
    assert.deepEqual(computePace(ticked, todayIndex), { kind: "done", percent: pace.target });
    checked++;
  }
  assert.ok(checked > 200, `only ${checked} open cases were generated`);
});

test("the target still lands exactly when a later day already has ticks", () => {
  // Saturday is today (1 of 3 done), yet Sunday somehow has 2 ticks (a timezone change can do this).
  const week = weekOf([[1, 3], [2, 4], [0, 5], [0, 5], [0, 5], [0, 5], [0, 4]]);
  assert.equal(week.total, 31);
  assert.deepEqual(computePace(week, 0), { kind: "open", open: 2, total: 3, target: 16 }); // (3 + 2) / 31
});

// --------------------------------------------------------------------------
console.log("task names");

test("cleanTaskName / plural", () => {
  assert.equal(cleanTaskName("  Work   (SWE) \n"), "Work (SWE)");
  assert.equal(plural(0, "task"), "0 tasks");
  assert.equal(plural(1, "task"), "1 task");
  assert.equal(plural(2, "task"), "2 tasks");
  assert.equal(plural(1, "day"), "1 day");
});

test("taskKey: spellings of one name share a key, different names don't", () => {
  for (const spelling of ["Work", "work", "WORK", "Work-", " Work. ", "W ork", "Wor-k"]) {
    assert.equal(taskKey(spelling), taskKey("Work"), spelling);
  }
  assert.notEqual(taskKey("Work (SWE)"), taskKey("Work (Design)"));
  assert.notEqual(taskKey("Read"), taskKey("Read (Book)"));
  assert.equal(taskKey("Read (Book)"), taskKey("read  book"));
  assert.notEqual(taskKey("Exercise 1"), taskKey("Exercise 2"));
  // a name with no letters or digits keeps an identity of its own
  assert.notEqual(taskKey("\u{1F4AA}"), taskKey("\u{1F3C3}"));
  assert.equal(taskKey("\u{1F4AA}"), taskKey(" \u{1F4AA} "));
  // other scripts work too (combining marks are kept)
  const bn = taskKey("\u09AC\u09CD\u09AF\u09BE\u09AF\u09BC\u09BE\u09AE");
  assert.ok(bn.length > 0);
  assert.notEqual(bn, taskKey("\u09AA\u09DC\u09BE"));
});

test("mergeOrder follows the request and never drops anything", () => {
  assert.deepEqual(mergeOrder(["b", "a"], ["a", "b", "c"]), ["b", "a", "c"]);
  assert.deepEqual(mergeOrder(["z", "b", "b"], ["a", "b", "c"]), ["b", "a", "c"]); // unknown ids and repeats ignored
  assert.deepEqual(mergeOrder([], ["a", "b"]), ["a", "b"]);
  assert.deepEqual(mergeOrder(["c", "a", "b"], ["a", "b", "c"]), ["c", "a", "b"]);
});

// --------------------------------------------------------------------------
console.log("stats helpers");

test("percentOf / aggregatePercent", () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(2, 3), 67);
  assert.equal(aggregatePercent([{ done: 1, total: 2 }, { done: 9, total: 10 }]), 83); // 10/12, not mean of means
});

test("runStats", () => {
  assert.deepEqual(runStats([]), { current: 0, longest: 0 });
  assert.deepEqual(runStats([false]), { current: 0, longest: 0 });
  assert.deepEqual(runStats([true, true, false, true]), { current: 1, longest: 2 });
  assert.deepEqual(runStats([true, true, true]), { current: 3, longest: 3 });
  assert.deepEqual(runStats([true, false, true, true, true, false]), { current: 0, longest: 3 });
});

test("rankTasks drops thin samples and orders weakest first, stably", () => {
  const ranked = rankTasks([
    { name: "Read", total: 10, done: 9 },
    { name: "Gym", total: 6, done: 3 },
    { name: "Rare", total: 2, done: 2 },
    { name: "Journal", total: 10, done: 9 },
    { name: "Code", total: 12, done: 9 },
  ]);
  assert.deepEqual(
    ranked.map((t) => [t.name, t.percent]),
    [
      ["Gym", 50],
      ["Code", 75],
      ["Journal", 90],
      ["Read", 90],
    ]
  );
});

test("formatClock / median", () => {
  assert.equal(formatClock(0), "12:00 AM");
  assert.equal(formatClock(5), "12:05 AM");
  assert.equal(formatClock(720), "12:00 PM");
  assert.equal(formatClock(1260), "9:00 PM");
  assert.equal(formatClock(1439), "11:59 PM");
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("date helpers", () => {
  assert.equal(addDaysToDateKey("2026-10-03", 7), "2026-10-10");
  assert.equal(addDaysToDateKey("2026-10-03", -3), "2026-09-30");
  assert.equal(addDaysToDateKey("2026-12-30", 3), "2027-01-02");
  assert.equal(diffDateKeys("2026-10-03", "2026-10-10"), 7);
  assert.equal(diffDateKeys("2026-10-10", "2026-10-03"), -7);
  assert.equal(diffDateKeys("2026-02-27", "2026-03-02"), 3);
  // 15:30 UTC is 21:30 in Dhaka (UTC+6)
  assert.equal(getLocalMinutesOfDay(new Date("2026-10-04T15:30:00Z"), "Asia/Dhaka"), 21 * 60 + 30);
  assert.equal(getLocalMinutesOfDay(new Date("2026-10-04T18:30:00Z"), "Asia/Dhaka"), 30); // 00:30 next day
});

// --------------------------------------------------------------------------
console.log("computeInsights");

const day = (date: string, dayIndex: number, weekNumber: number, finalized: boolean, done: number, total: number): DayRow => ({
  date,
  dayIndex,
  weekNumber,
  finalized,
  done,
  total,
});

// Week 1 (2026-09-19): 89%   Week 2 (2026-09-26): 97%   Week 3 live (2026-10-03)
const days: DayRow[] = [
  day("2026-09-19", 0, 1, true, 5, 5),
  day("2026-09-20", 1, 1, true, 4, 5),
  day("2026-09-21", 2, 1, true, 3, 3),
  day("2026-09-22", 3, 1, true, 0, 0), // rest day: must be invisible
  day("2026-09-23", 4, 1, true, 2, 4),
  day("2026-09-24", 5, 1, true, 5, 5),
  day("2026-09-25", 6, 1, true, 5, 5),
  day("2026-09-26", 0, 2, true, 4, 5),
  day("2026-09-27", 1, 2, true, 5, 5),
  day("2026-09-28", 2, 2, true, 3, 3),
  day("2026-09-29", 3, 2, true, 4, 4),
  day("2026-09-30", 4, 2, true, 5, 5),
  day("2026-10-01", 5, 2, true, 5, 5),
  day("2026-10-02", 6, 2, true, 5, 5),
  day("2026-10-03", 0, 3, false, 5, 5),
  day("2026-10-04", 1, 3, false, 5, 5),
  day("2026-10-05", 2, 3, false, 2, 3),
  day("2026-10-06", 3, 3, false, 1, 4), // today, still open
  day("2026-10-07", 4, 3, false, 0, 5), // future
];

const taskRows: TaskRow[] = [
  { name: "Read", total: 10, done: 9 },
  { name: "Gym", total: 6, done: 3 },
  { name: "Rare", total: 2, done: 2 },
  { name: "Journal", total: 10, done: 9 },
];

const TZ = "Asia/Dhaka";
const ticks: TickRow[] = [
  { date: "2026-10-04", completedAt: new Date("2026-10-04T15:30:00Z") }, // 21:30 local
  { date: "2026-10-04", completedAt: new Date("2026-10-04T16:10:00Z") }, // 22:10
  { date: "2026-10-05", completedAt: new Date("2026-10-05T18:30:00Z") }, // 00:30 on the 6th — after midnight
  { date: "2026-10-05", completedAt: new Date("2026-10-05T14:00:00Z") }, // 20:00
  { date: "2026-10-06", completedAt: new Date("2026-10-06T03:00:00Z") }, // 09:00 today
];

const base = { todayKey: "2026-10-06", timeZone: TZ, days, tasks: taskRows, ticks };

test("overview counts finished days only", () => {
  const r = computeInsights(base);
  assert.equal(r.hasData, true);
  // 24 + 31 + 12 done of 27 + 32 + 13 on the 16 closed days (the rest day, today and the future are out)
  assert.deepEqual(r.overview, { percent: 93, done: 67, total: 72, finishedWeeks: 2, perfectDays: 12 });
});

test("streaks: rest days skipped, an open today neither breaks nor extends", () => {
  const r = computeInsights(base);
  assert.deepEqual(r.streaks.perfect, { current: 0, longest: 8 });
  // every closed day had something done, and today has started: 16 + 1
  assert.deepEqual(r.streaks.active, { current: 17, longest: 17 });
});

test("a finished today extends the streaks", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-06" ? { ...d, done: 4, total: 4 } : d)),
  });
  assert.deepEqual(r.streaks.perfect, { current: 1, longest: 8 });
  assert.equal(r.overview.perfectDays, 13);
});

test("an untouched today neither breaks nor extends the active run", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-06" ? { ...d, done: 0 } : d)),
  });
  assert.deepEqual(r.streaks.active, { current: 16, longest: 16 });
});

test("a closed day with nothing done ends the active run", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-05" ? { ...d, done: 0 } : d)),
  });
  assert.deepEqual(r.streaks.active, { current: 1, longest: 15 });
});

test("a day closed short breaks the perfect streak, yesterday perfect keeps it", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-05" ? { ...d, done: 3, total: 3 } : d)),
  });
  // ...week 2 d1..d6 (6) + week 3 d0, d1, d2 (3) = 9 in a row, today still open
  assert.deepEqual(r.streaks.perfect, { current: 9, longest: 9 });
});

test("weeks: every finished week, the average, the best, the latest", () => {
  const r = computeInsights(base);
  assert.deepEqual(r.weeks.list, [
    { weekNumber: 1, percent: 89 },
    { weekNumber: 2, percent: 97 },
  ]);
  assert.equal(r.weeks.average, 93); // (24 + 31) / (27 + 32), not a mean of means
  assert.deepEqual(r.weeks.best, { weekNumber: 2, percent: 97 });
  assert.deepEqual(r.weeks.latest, { weekNumber: 2, percent: 97, vsAverage: 4 });
});

test("a single finished week has nothing to compare with yet", () => {
  const r = computeInsights({ ...base, days: days.filter((d) => d.weekNumber !== 2) });
  assert.deepEqual(r.weeks.latest, { weekNumber: 1, percent: 89, vsAverage: null });
});

test("weekdays, and the strongest and weakest day", () => {
  const r = computeInsights(base);
  assert.deepEqual(
    r.weekdays.map((w) => w.percent),
    [93, 93, 89, 100, 78, 100, 100]
  );
  assert.deepEqual(
    r.weekdays.map((w) => w.days),
    [3, 3, 3, 1, 2, 2, 2]
  );
  assert.deepEqual(r.dayExtremes, { best: { dayIndex: 3, percent: 100 }, worst: { dayIndex: 4, percent: 78 } });
});

test("no strongest or weakest day until two weekdays differ", () => {
  const one = computeInsights({ ...base, days: [day("2026-09-19", 0, 1, true, 5, 5)] });
  assert.equal(one.dayExtremes, null);
  const same = computeInsights({
    ...base,
    days: [day("2026-09-19", 0, 1, true, 5, 5), day("2026-09-20", 1, 1, true, 4, 4)],
  });
  assert.equal(same.dayExtremes, null);
});

test("task ranking comes through", () => {
  const r = computeInsights(base);
  assert.deepEqual(
    r.tasks.map((t) => [t.name, t.percent, t.done, t.total]),
    [
      ["Gym", 50, 3, 6],
      ["Journal", 90, 9, 10],
      ["Read", 90, 9, 10],
    ]
  );
});

test("clock: median, buckets, after-midnight days (today excluded)", () => {
  const r = computeInsights(base);
  assert.equal(r.clock.ticks, 5);
  assert.equal(r.clock.medianLabel, "9:30 PM");
  assert.equal(r.clock.hourBuckets.length, 24);
  const expected = new Array<number>(24).fill(0);
  for (const i of [3, 14, 15, 16, 18]) expected[i] = 1;
  assert.deepEqual(r.clock.hourBuckets, expected);
  assert.equal(r.clock.tickDays, 2);
  assert.equal(r.clock.afterMidnightDays, 1);
});

test("a tick at exactly 06:00 sits in the first bucket, 05:59 in the last", () => {
  const r = computeInsights({
    ...base,
    ticks: [
      { date: "2026-10-04", completedAt: new Date("2026-10-04T00:00:00Z") }, // 06:00 Dhaka
      { date: "2026-10-04", completedAt: new Date("2026-10-04T23:59:00Z") }, // 05:59 next morning Dhaka
    ],
  });
  assert.equal(r.clock.hourBuckets[0], 1);
  assert.equal(r.clock.hourBuckets[23], 1);
  assert.equal(r.clock.afterMidnightDays, 1);
});

test("no data at all", () => {
  const r = computeInsights({ todayKey: "2026-10-06", timeZone: TZ, days: [], tasks: [], ticks: [] });
  assert.equal(r.hasData, false);
  assert.deepEqual(r.overview, { percent: 0, done: 0, total: 0, finishedWeeks: 0, perfectDays: 0 });
  assert.deepEqual(r.streaks.perfect, { current: 0, longest: 0 });
  assert.deepEqual(r.streaks.active, { current: 0, longest: 0 });
  assert.deepEqual(r.weeks, { list: [], average: null, best: null, latest: null });
  assert.equal(r.dayExtremes, null);
  assert.ok(r.weekdays.every((w) => w.percent === null && w.days === 0));
  assert.equal(r.clock.medianLabel, null);
  assert.deepEqual(r.tasks, []);
});

test("first day of week 1: only an open today", () => {
  const r = computeInsights({
    todayKey: "2026-10-03",
    timeZone: TZ,
    days: [day("2026-10-03", 0, 1, false, 2, 5)],
    tasks: [],
    ticks: [],
  });
  assert.equal(r.hasData, false); // nothing has closed yet
  assert.deepEqual(r.streaks.perfect, { current: 0, longest: 0 });
  assert.deepEqual(r.streaks.active, { current: 1, longest: 1 }); // something is done today
});

test("all of history is counted, however long it gets", () => {
  const manyDays: DayRow[] = [];
  // 60 finished weeks, one day each: 50% for weeks 1-30, 90% for weeks 31-60
  for (let w = 1; w <= 60; w++) {
    manyDays.push(day(addDaysToDateKey("2025-06-07", (w - 1) * 7), 0, w, true, w <= 30 ? 5 : 9, 10));
  }
  const r = computeInsights({ todayKey: "2026-10-06", timeZone: TZ, days: manyDays, tasks: [], ticks: [] });
  assert.equal(r.overview.finishedWeeks, 60);
  assert.equal(r.weeks.list.length, 60);
  assert.equal(r.weeks.average, 70);
  assert.deepEqual(r.weeks.best, { weekNumber: 60, percent: 90 }); // ties go to the newer week
  assert.deepEqual(r.weeks.latest, { weekNumber: 60, percent: 90, vsAverage: 20 });
});

// --------------------------------------------------------------------------
console.log("confetti engine");

/** Small seeded generator so the checks are repeatable. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("a burst has the requested size, starts at the origin and stays inside its fan", () => {
  const ps = createBurst({ x: 100, y: 200, count: 80, angle: -Math.PI / 2, spread: 1.0, power: 16, rand: seeded(7) });
  assert.equal(ps.length, 80);
  for (const p of ps) {
    assert.equal(p.x, 100);
    assert.equal(p.y, 200);
    const heading = Math.atan2(p.vy, p.vx);
    assert.ok(heading >= -Math.PI / 2 - 0.5 - 1e-9 && heading <= -Math.PI / 2 + 0.5 + 1e-9, `heading ${heading}`);
    assert.ok(CONFETTI_COLORS.includes(p.color));
    assert.ok(p.ttl >= 110 && p.ttl <= 180);
    assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy));
  }
});

test("pieces rise, then fall, and every one is gone by the end of its life", () => {
  let ps = createBurst({ x: 0, y: 500, count: 60, power: 16, rand: seeded(11) });
  const startY = 500;
  let sawRise = false;
  let sawFall = false;
  for (let frame = 0; frame < 400 && ps.length > 0; frame++) {
    ps = stepParticles(ps, 1, 2000);
    for (const p of ps) {
      if (p.y < startY - 20) sawRise = true;
      if (p.vy > 0) sawFall = true;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
  assert.ok(sawRise && sawFall);
  assert.equal(ps.length, 0, "nothing may outlive its ttl");
});

test("frame rate does not change the result much: 1 step of dt=2 ~ 2 steps of dt=1", () => {
  const a = createBurst({ x: 0, y: 0, count: 1, rand: seeded(3) });
  const b = JSON.parse(JSON.stringify(a)) as typeof a;
  stepParticles(a, 2, 5000);
  stepParticles(b, 1, 5000);
  stepParticles(b, 1, 5000);
  assert.ok(Math.abs(a[0]!.y - b[0]!.y) < 4, `${a[0]!.y} vs ${b[0]!.y}`);
  assert.ok(Math.abs(a[0]!.vy - b[0]!.vy) < 0.5);
  assert.ok(DRAG > 0 && DRAG < 1);
});

test("pieces that fall off the bottom are dropped early", () => {
  // Fired downward from 10px above the bottom edge: within a handful of
  // frames every piece is well past the edge, long before its ttl (110+ frames).
  let ps = createBurst({ x: 0, y: 990, count: 10, angle: Math.PI / 2, spread: 0.2, power: 20, rand: seeded(5) });
  for (let i = 0; i < 6; i++) ps = stepParticles(ps, 1, 1000);
  assert.equal(ps.length, 0);
});

test("alpha is 1, then fades to 0 over the last third of life", () => {
  const p = createBurst({ x: 0, y: 0, count: 1, rand: seeded(1) })[0]!;
  p.ttl = 100;
  p.age = 0;
  assert.equal(particleAlpha(p), 1);
  p.age = 65;
  assert.equal(particleAlpha(p), 1);
  p.age = 82.5;
  assert.ok(Math.abs(particleAlpha(p) - 0.5) < 1e-9);
  p.age = 100;
  assert.equal(particleAlpha(p), 0);
});

console.log(`\n${passed} checks passed`);
