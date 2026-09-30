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
}

export interface DayEntry {
  dayIndex: DayIndex;
  /** ISO date (YYYY-MM-DD) this app-day maps to. */
  dateKey: string;
  tasks: TaskEntry[];
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
}

export interface CurrentWeek extends WeekSummary {
  days: DayEntry[];
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
