/**
 * The few numbers the insight features share, in one place so the Insights
 * page, the week-closed sheet and the weekly email can never disagree.
 */

/** A task needs at least this many finished occurrences before it is ranked —
 * two data points say nothing about consistency. */
export const MIN_TASK_SAMPLES = 3;

/** Longest allowed week note. Mirrored by a check constraint on week_notes
 * (schema.sql, and lib/notes.ts for databases created before it changed). */
export const NOTE_MAX_LENGTH = 200;
