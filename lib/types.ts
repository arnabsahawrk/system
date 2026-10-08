/**
 * Shared shapes, used by both the database layer (lib/weeks.ts,
 * lib/task-templates.ts) and the components that render them.
 */

/** 0 = Saturday … 6 = Friday. See lib/date.ts for why the week starts here. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayIndex, string> = {
  0: "Saturday",
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
};

export const DAY_SHORT_LABELS: Record<DayIndex, string> = {
  0: "Sat",
  1: "Sun",
  2: "Mon",
  3: "Tue",
  4: "Wed",
  5: "Thu",
  6: "Fri",
};

export interface TaskEntry {
  id: string;
  name: string;
  completed: boolean;
  /** Today's tasks only. How many scheduled occurrences of this task (matched
   * by name) were finished in a row, ending at its last *closed* occurrence —
   * today not counted. The UI adds one while today's tick is on, so the
   * number moves instantly with the checkbox, no round trip. */
  chain?: number;
}

export interface DayEntry {
  dayIndex: DayIndex;
  /** ISO date (YYYY-MM-DD) this app-day maps to. */
  dateKey: string;
  tasks: TaskEntry[];
}

/** Done / total for one day — what each cell of a Records strip is drawn from. */
export interface DayStat {
  done: number;
  total: number;
}

export interface WeekSummary {
  weekNumber: number;
  /** ISO date (YYYY-MM-DD) of the Saturday this week started on. */
  startDateKey: string;
  completed: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
  finalized: boolean;
  /** Seven entries, Sat..Fri. Present on every week the history API returns;
   * the live week's strip is derived from its own day cards instead. */
  dayStats?: DayStat[];
  /** The one-line "what got in the way?" reflection, if one was written. */
  note?: string | null;
}

export interface CurrentWeek extends WeekSummary {
  days: DayEntry[];
}

/** One finished week with every task, for the Records post-mortem. */
export type WeekDetail = CurrentWeek;

export interface WeakestTask {
  name: string;
  /** 0–100, rounded. */
  percent: number;
  done: number;
  total: number;
}

/** What the week-closed sheet and the weekly email say about a finished week. */
export interface Verdict {
  weekNumber: number;
  startDateKey: string;
  endDateKey: string;
  completed: number;
  total: number;
  percent: number;
  dayStats: DayStat[];
  prevWeek: { weekNumber: number; percent: number } | null;
  /** percent minus the previous week's percent; null with no previous week. */
  delta: number | null;
  /** Finished weeks in a row, ending with this one, at or above the target.
   * 0 when this week itself missed it. */
  weekStreak: number;
  /** Days this week finished at 100%. */
  perfectDays: number;
  weakestTask: WeakestTask | null;
  note: string | null;
}

/** All-time stats footer for the Tracker — computed over every finalized
 * week, independent of how many are currently paginated into view. */
export interface HistoryStats {
  weekCount: number;
  avgCompleted: number;
  avgTotal: number;
  avgPercent: number;
}

export interface HistoryPage {
  weeks: WeekSummary[];
  stats: HistoryStats;
  hasMore: boolean;
}

/** A single task-name row in the editable per-day template. */
export interface TaskTemplateItem {
  id: string;
  dayIndex: DayIndex;
  name: string;
  sortOrder: number;
}

/** One device that has biometric unlock switched on. */
export interface BiometricDevice {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}
