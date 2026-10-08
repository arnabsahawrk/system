import { renderWeeklySummaryEmail } from "../lib/email";
import { mkdirSync, writeFileSync } from "node:fs";

const sample = renderWeeklySummaryEmail({
  weekNumber: 7,
  startDateKey: "2026-09-19",
  endDateKey: "2026-09-25",
  completed: 22,
  total: 25,
  percent: 88,
  // How the week compares with the ones around it — made-up numbers, purely to
  // render the extra rows (change vs last week, streak, day strip, weakest task).
  verdict: {
    weekNumber: 7,
    startDateKey: "2026-09-19",
    endDateKey: "2026-09-25",
    completed: 22,
    total: 25,
    percent: 88,
    dayStats: [
      { done: 4, total: 5 },
      { done: 4, total: 5 },
      { done: 3, total: 3 },
      { done: 3, total: 4 },
      { done: 3, total: 3 },
      { done: 5, total: 5 },
      { done: 0, total: 0 }, // the rest day
    ],
    prevWeek: { weekNumber: 6, percent: 82 },
    delta: 6,
    weekStreak: 3,
    perfectDays: 3,
    weakestTask: { name: "Exercise", percent: 62, done: 5, total: 8 },
    note: null,
  },
  days: [
    {
      dayIndex: 0,
      dateKey: "2026-09-19",
      tasks: [
        { id: "1", name: "Exercise", completed: true },
        { id: "2", name: "Work (SWE)", completed: true },
        { id: "3", name: "Learn (English)", completed: true },
        { id: "4", name: "Read (Book)", completed: false },
        { id: "5", name: "Journal", completed: true },
      ],
    },
    {
      dayIndex: 1,
      dateKey: "2026-09-20",
      tasks: [
        { id: "6", name: "Exercise", completed: true },
        { id: "7", name: "Work (SWE)", completed: true },
        { id: "8", name: "Learn (English)", completed: true },
        { id: "9", name: "Read (Book)", completed: true },
        { id: "10", name: "Journal", completed: false },
      ],
    },
    {
      dayIndex: 2,
      dateKey: "2026-09-21",
      tasks: [
        { id: "11", name: "Work (SWE)", completed: true },
        { id: "12", name: "Learn (English)", completed: true },
        { id: "13", name: "Journal", completed: true },
      ],
    },
    {
      dayIndex: 3,
      dateKey: "2026-09-22",
      tasks: [
        { id: "14", name: "Exercise", completed: false },
        { id: "15", name: "Work (SWE)", completed: true },
        { id: "16", name: "Learn (English)", completed: true },
        { id: "17", name: "Read (Book)", completed: true },
      ],
    },
    {
      dayIndex: 4,
      dateKey: "2026-09-23",
      tasks: [
        { id: "18", name: "Work (SWE)", completed: true },
        { id: "19", name: "Learn (English)", completed: true },
        { id: "20", name: "Journal", completed: true },
      ],
    },
    {
      dayIndex: 5,
      dateKey: "2026-09-24",
      tasks: [
        { id: "21", name: "Exercise", completed: true },
        { id: "22", name: "Work (SWE)", completed: true },
        { id: "23", name: "Learn (English)", completed: true },
        { id: "24", name: "Read (Book)", completed: true },
        { id: "25", name: "Journal", completed: true },
      ],
    },
    {
      dayIndex: 6,
      dateKey: "2026-09-25",
      tasks: [], // a rest day — demonstrates the "Rest day" wording for an empty day
    },
  ],
});

mkdirSync("preview", { recursive: true });
writeFileSync("preview/email-preview.html", sample.html, "utf-8");
console.log("Subject:", sample.subject);
console.log("--- text version ---");
console.log(sample.text);
console.log("\nWrote preview/email-preview.html");
