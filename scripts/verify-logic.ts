/**
 * Pure-logic checks for the numbers and motion the newer features rely on:
 * the pace line, streaks, personal bests, weekday shape, task ranking, the
 * tick clock, and the confetti physics. No database or browser needed —
 * every function under test takes plain values.
 *
 *   npm run verify:logic
 */
import assert from "node:assert/strict";
import { computeInsights } from "../lib/insights";
import type { DayRow, TaskRow, TickRow } from "../lib/insights";
import { computePace, paceText, tasksNeededFor, openTaskCount } from "../lib/pace";
import {
  aggregatePercent,
  formatClock,
  median,
  percentOf,
  rankTasks,
  runStats,
  weekStreakEndingAt,
} from "../lib/stats";
import { addDaysToDateKey, diffDateKeys, getLocalMinutesOfDay } from "../lib/date";
import { CONFETTI_COLORS, DRAG, createBurst, particleAlpha, stepParticles } from "../lib/confetti-engine";
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

test("tasksNeededFor matches the displayed percentage for every total and target", () => {
  // The definition: the fewest completed tasks whose Math.round percentage
  // reaches the target. Brute-forced so no rounding edge can hide.
  for (const target of [50, 60, 70, 75, 80, 85, 90, 95, 100]) {
    for (let total = 1; total <= 300; total++) {
      let expected = total;
      for (let c = 0; c <= total; c++) {
        if (Math.round((c / total) * 100) >= target) {
          expected = c;
          break;
        }
      }
      assert.equal(tasksNeededFor(total, target), expected, `total=${total} target=${target}`);
    }
  }
  assert.equal(tasksNeededFor(0, 80), 0);
});

test("computePace: need / reached / out / none", () => {
  assert.deepEqual(computePace(25, 10, 15), { kind: "need", target: 80, need: 10, open: 15 });
  assert.deepEqual(computePace(25, 20, 5), { kind: "reached", target: 80 });
  assert.deepEqual(computePace(25, 25, 0), { kind: "reached", target: 80 });
  assert.deepEqual(computePace(25, 5, 10), { kind: "out", target: 80, best: 60 });
  assert.deepEqual(computePace(25, 10, 10), { kind: "need", target: 80, need: 10, open: 10 });
  assert.deepEqual(computePace(25, 10, 9), { kind: "out", target: 80, best: 76 });
  assert.deepEqual(computePace(0, 0, 0), { kind: "none" });
});

test("paceText wording", () => {
  assert.equal(paceText({ kind: "none" }), null);
  assert.equal(paceText({ kind: "reached", target: 80 }), "80% target reached");
  assert.equal(
    paceText({ kind: "need", target: 80, need: 9, open: 12 }),
    "Need 9 of the 12 open tasks to reach 80%"
  );
  assert.equal(
    paceText({ kind: "need", target: 80, need: 1, open: 1 }),
    "Need 1 of the 1 open task to reach 80%"
  );
  assert.equal(
    paceText({ kind: "out", target: 80, best: 76 }),
    "Best possible now: 76% \u2014 80% is out of reach"
  );
});

test("openTaskCount counts only today and later, unticked", () => {
  const mk = (dayIndex: DayIndex, flags: boolean[]) => ({
    dayIndex,
    dateKey: "2026-10-03",
    tasks: flags.map((completed, i) => ({ id: `${dayIndex}-${i}`, name: "t", completed })),
  });
  const week: CurrentWeek = {
    weekNumber: 1,
    startDateKey: "2026-10-03",
    completed: 0,
    total: 0,
    percent: 0,
    finalized: false,
    days: [
      mk(0, [false, false]), // past — locked for good
      mk(1, [true, false]), // past
      mk(2, [true, false, false]), // today: 2 open
      mk(3, [false]), // future: 1 open
      mk(4, []),
      mk(5, [true, true]),
      mk(6, [false, false]), // future: 2 open
    ],
  };
  assert.equal(openTaskCount(week, 2), 5);
  assert.equal(openTaskCount(week, 0), 8);
  assert.equal(openTaskCount(week, 6), 2);
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

test("weekStreakEndingAt", () => {
  const weeks = [
    { weekNumber: 4, percent: 90, total: 10 },
    { weekNumber: 5, percent: 85, total: 10 },
    { weekNumber: 6, percent: 79, total: 10 },
    { weekNumber: 7, percent: 80, total: 10 },
    { weekNumber: 8, percent: 100, total: 10 },
  ];
  assert.equal(weekStreakEndingAt(weeks, 8, 80), 2); // 8, 7 — then 6 misses
  assert.equal(weekStreakEndingAt(weeks, 6, 80), 0);
  assert.equal(weekStreakEndingAt(weeks, 5, 80), 2); // 5, 4
  assert.equal(weekStreakEndingAt(weeks, 99, 80), 0);
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

test("streaks: rest days skipped, open today neither breaks nor extends", () => {
  const r = computeInsights(base);
  assert.equal(r.hasData, true);
  assert.equal(r.closedDays, 16); // 6 + 7 + 3 (rest day and future/today excluded)
  assert.deepEqual(r.streaks.perfectDays, { current: 0, longest: 8 });
  assert.deepEqual(r.streaks.strongDays, { current: 0, longest: 11 });
  assert.deepEqual(r.streaks.weeks, { current: 2, longest: 2 });
});

test("a finished today extends the streaks", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-06" ? { ...d, done: 4, total: 4 } : d)),
  });
  assert.deepEqual(r.streaks.perfectDays, { current: 1, longest: 8 });
  assert.deepEqual(r.streaks.strongDays, { current: 1, longest: 11 });
  assert.equal(r.bests.perfectDays, 13);
});

test("a day closed short breaks the streak, yesterday perfect keeps it", () => {
  const r = computeInsights({
    ...base,
    days: days.map((d) => (d.date === "2026-10-05" ? { ...d, done: 3, total: 3 } : d)),
  });
  // ...week 2 d1..d6 (6) + week 3 d0, d1, d2 (3) = 9 in a row, today still open
  assert.deepEqual(r.streaks.perfectDays, { current: 9, longest: 9 });
});

test("personal bests", () => {
  const r = computeInsights(base);
  assert.deepEqual(r.bests.bestWeek, { weekNumber: 2, percent: 97, done: 31, total: 32 });
  assert.deepEqual(r.bests.mostTasks, { weekNumber: 2, done: 31 });
  assert.deepEqual(r.bests.biggestJump, { weekNumber: 2, fromWeekNumber: 1, delta: 8 });
  assert.equal(r.bests.perfectDays, 12);
});

test("weekday shape and trend", () => {
  const r = computeInsights(base);
  const pct = r.shape.weekdays.map((w) => w.percent);
  assert.deepEqual(pct, [93, 93, 89, 100, 78, 100, 100]);
  assert.deepEqual(
    r.shape.weekdays.map((w) => w.days),
    [3, 3, 3, 1, 2, 2, 2]
  );
  assert.equal(r.shape.sampleWeeks, 3);
  assert.deepEqual(r.shape.trend, { weeks: 1, recent: 97, prior: 89, delta: 8 });
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
  assert.deepEqual(r.streaks.perfectDays, { current: 0, longest: 0 });
  assert.equal(r.bests.bestWeek, null);
  assert.equal(r.bests.biggestJump, null);
  assert.equal(r.shape.trend, null);
  assert.ok(r.shape.weekdays.every((w) => w.percent === null && w.days === 0));
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
  assert.deepEqual(r.streaks.perfectDays, { current: 0, longest: 0 });
});

test("trend window grows with history: 8+ weeks compares 4 vs 4", () => {
  const manyDays: DayRow[] = [];
  // 9 finished weeks, one day each: percent = 50 for weeks 1-5, 80 for weeks 6-9
  for (let w = 1; w <= 9; w++) {
    manyDays.push(day(addDaysToDateKey("2026-06-06", (w - 1) * 7), 0, w, true, w <= 5 ? 5 : 8, 10));
  }
  const r = computeInsights({ todayKey: "2026-10-06", timeZone: TZ, days: manyDays, tasks: [], ticks: [] });
  assert.deepEqual(r.shape.trend, { weeks: 4, recent: 80, prior: 50, delta: 30 });
  assert.equal(r.finishedWeeks, 9);
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
