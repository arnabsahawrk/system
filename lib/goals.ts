/**
 * The few numbers the new insight features share, in one place so the pace
 * line, the streaks, the Insights page, the week-closed sheet and the weekly
 * email can never disagree about what counts as a good day or week.
 */

/** A day or week at or above this percentage counts as "on target". */
export const TARGET_PERCENT = 80;

/** A task needs at least this many closed occurrences before it is ranked —
 * two data points say nothing about consistency. */
export const MIN_TASK_SAMPLES = 3;

/** How far back task consistency and the clock look. */
export const TASK_WINDOW_WEEKS = 8;

/** Longest allowed "what got in the way?" note. Mirrored by a check
 * constraint on week_notes (schema.sql). */
export const NOTE_MAX_LENGTH = 160;
