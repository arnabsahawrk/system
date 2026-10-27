"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RotateCw, Trash2, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { Collapse } from "./collapse";
import { MANAGE_LAYOUT, ManageBodySkeleton, ManageFrame } from "./manage-skeleton";
import { goToUnlock } from "@/lib/nav";
import { isTabUnlocked } from "@/lib/tab-lock";
import { MAX_NAME_LEN, MAX_TASKS_PER_DAY, plural } from "@/lib/task-name";
import { DAY_LABELS, DAY_SHORT_LABELS } from "@/lib/types";
import type { DayIndex, PlanTask, TaskPlan } from "@/lib/types";

const DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
const EMPTY_SCHEDULE: string[][] = [[], [], [], [], [], [], []];
const JSON_HEADERS = { "Content-Type": "application/json" };
const NOTICE_MS = 5000;
const CONFIRM_MS = 4000;

/** `list` with the item at `index` moved one step (-1 up, +1 down) — the same
 * array back when it can't move. */
function moved<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item as T);
  return next;
}

function daysSummary(days: DayIndex[]): string {
  if (days.length === 0) return "No days yet";
  if (days.length === 7) return "Every day";
  return days.map((d) => DAY_SHORT_LABELS[d]).join(" \u00B7 ");
}

/**
 * The plan for the weeks to come, in two parts that are one set of data:
 *  - Tasks: every task, named once. Open one to switch it on for the days it
 *    belongs to. Reorder it or delete it here.
 *  - Week: what each day will contain. Reorder a day's tasks or take one off
 *    that day — the same as switching the day off in the task.
 * Because a task is typed once and then only switched on and off, it can never
 * end up spelled two ways. Nothing here touches the week that is running.
 *
 * Changes show at once and are sent one after another in the order they were
 * made. If one fails, a notice says so and the screen re-syncs from the server.
 */
export function ManageTasks({ hasPasscode }: { hasPasscode: boolean }) {
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0); // changes sent or waiting to be
  const stale = useRef(false); // the screen may no longer match the server
  const noticeTimer = useRef<number | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    if (hasPasscode && !isTabUnlocked()) goToUnlock();
  }, [hasPasscode]);

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    []
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  /** Fetches the plan. Returns false if it couldn't. A snapshot that arrives
   * while changes are still on their way is dropped (it may predate them) and
   * fetched again once they've landed. */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/tasks");
      if (res.status === 401) {
        goToUnlock();
        return true;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as TaskPlan;
      if (pending.current > 0) {
        stale.current = true;
        return true;
      }
      setPlan(data);
      setLoadFailed(false);
      return true;
    } catch {
      setLoadFailed(true);
      return false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Queues one change to the server. When the last queued change has landed,
   * the screen is re-synced if any of them failed. */
  const send = useCallback(
    (run: () => Promise<Response>) => {
      pending.current++;
      chain.current = chain.current
        .then(async () => {
          let problem: string | null = null;
          try {
            const res = await run();
            if (res.status === 401) {
              goToUnlock();
              return;
            }
            if (!res.ok) {
              const json = (await res.json().catch(() => ({}))) as { error?: string };
              problem = json.error ?? "That change didn't save.";
            }
          } catch {
            problem = "Couldn't reach the app. Check the connection.";
          }
          pending.current--;
          if (problem) {
            stale.current = true;
            showNotice(problem);
          }
          if (pending.current === 0 && stale.current) {
            stale.current = false;
            if (!(await load())) showNotice("Couldn't refresh. Reload the page.");
          }
        })
        .catch(() => {});
    },
    [load, showNotice]
  );

  const byId = useMemo(() => new Map((plan?.tasks ?? []).map((t) => [t.id, t] as const)), [plan]);
  const tasks = plan?.tasks ?? [];
  const schedule = plan?.schedule ?? EMPTY_SCHEDULE;
  const slots = schedule.reduce((n, ids) => n + ids.length, 0);
  const daysOf = (id: string): DayIndex[] => DAYS.filter((d) => schedule[d]?.includes(id));
  const isFull = (d: DayIndex, id: string) =>
    !(schedule[d] ?? []).includes(id) && (schedule[d]?.length ?? 0) >= MAX_TASKS_PER_DAY;

  // ---- changes --------------------------------------------------------------

  function setDays(taskId: string, next: DayIndex[]) {
    if (!plan) return;
    const full = next.find((d) => isFull(d, taskId));
    if (full !== undefined) {
      showNotice(`${DAY_LABELS[full]} already has ${MAX_TASKS_PER_DAY} tasks.`);
      return;
    }
    const want = new Set<number>(next);
    setPlan({
      ...plan,
      schedule: plan.schedule.map((ids, d) => {
        const has = ids.includes(taskId);
        if (has === want.has(d)) return ids;
        return has ? ids.filter((x) => x !== taskId) : [...ids, taskId];
      }),
    });
    send(() =>
      fetch(`/api/tasks/${taskId}/days`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ days: next }) })
    );
  }

  function toggleDay(taskId: string, day: DayIndex) {
    const cur = daysOf(taskId);
    setDays(taskId, cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]);
  }

  function allDays(taskId: string) {
    const cur = daysOf(taskId);
    if (cur.length === 7) return setDays(taskId, []);
    const skipped = DAYS.filter((d) => isFull(d, taskId));
    setDays(taskId, DAYS.filter((d) => !skipped.includes(d)));
    if (skipped.length > 0) {
      showNotice(
        `${skipped.map((d) => DAY_SHORT_LABELS[d]).join(", ")} already ${skipped.length === 1 ? "has" : "have"} ${MAX_TASKS_PER_DAY} tasks.`
      );
    }
  }

  function moveTask(index: number, dir: -1 | 1) {
    if (!plan) return;
    const next = moved(plan.tasks, index, dir);
    if (next === plan.tasks) return;
    setPlan({ ...plan, tasks: next });
    send(() =>
      fetch("/api/tasks/reorder", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ orderedIds: next.map((t) => t.id) }),
      })
    );
  }

  function moveInDay(day: DayIndex, index: number, dir: -1 | 1) {
    if (!plan) return;
    const ids = plan.schedule[day] ?? [];
    const next = moved(ids, index, dir);
    if (next === ids) return;
    setPlan({ ...plan, schedule: plan.schedule.map((cur, d) => (d === day ? next : cur)) });
    send(() =>
      fetch("/api/tasks/reorder", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ dayIndex: day, orderedIds: next }),
      })
    );
  }

  function askDelete(id: string) {
    setConfirmId(id);
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmId(null), CONFIRM_MS);
  }

  function deleteTask(id: string) {
    if (!plan) return;
    setPlan({ tasks: plan.tasks.filter((t) => t.id !== id), schedule: plan.schedule.map((ids) => ids.filter((x) => x !== id)) });
    setOpenId((cur) => (cur === id ? null : cur));
    setConfirmId(null);
    send(() => fetch(`/api/tasks/${id}`, { method: "DELETE" }));
  }

  async function addTask() {
    const name = draft.replace(/\s+/g, " ").trim();
    if (!name || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await chain.current; // let earlier changes land first
      const res = await fetch("/api/tasks", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name }) });
      if (res.status === 401) {
        goToUnlock();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { task?: PlanTask; error?: string };
      if (!res.ok || !json.task) {
        setAddError(json.error ?? "Couldn't add that. Try again.");
        return;
      }
      const task = json.task;
      setPlan((p) => (p ? { ...p, tasks: [...p.tasks, task] } : p));
      setDraft("");
      // Open its days a moment later, so the row grows open instead of appearing open.
      window.requestAnimationFrame(() => setOpenId(task.id));
    } catch {
      setAddError("Couldn't reach the app. Check the connection.");
    } finally {
      setAdding(false);
    }
  }

  // ---- screens --------------------------------------------------------------

  if (!plan && loadFailed) {
    return (
      <ManageFrame>
        <div className="mx-auto flex max-w-sm animate-fade-in flex-col items-center gap-3 px-4 pt-16 text-center">
          <BrandMark size={30} className="opacity-60" />
          <p className="font-mono text-xs text-ink-muted">Couldn&apos;t load your tasks.</p>
          <button
            onClick={() => {
              setLoadFailed(false);
              void load();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 font-mono text-xs text-ink-muted transition-all hover:border-border-strong hover:text-ink active:scale-95"
          >
            <RotateCw size={12} /> Try again
          </button>
        </div>
      </ManageFrame>
    );
  }

  return (
    <ManageFrame>
      {notice && (
        <div className="mx-auto max-w-6xl animate-fade-in px-4 pt-3 sm:px-6" role="alert">
          <p className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
            {notice}
          </p>
        </div>
      )}

      {!plan ? (
        <ManageBodySkeleton />
      ) : (
        <main className={MANAGE_LAYOUT}>
          <section aria-labelledby="tasks-heading">
            <SectionHead id="tasks-heading" title="Tasks" count={plural(tasks.length, "task")} />
            <div className="overflow-hidden rounded-xl2 border border-border bg-surface shadow-card">
              {tasks.length === 0 ? (
                <p className="px-4 py-7 text-center font-mono text-xs text-ink-faint">
                  No tasks yet. Add your first one below.
                </p>
              ) : (
                <ul>
                  {tasks.map((task, i) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      index={i}
                      count={tasks.length}
                      days={daysOf(task.id)}
                      isFull={(d) => isFull(d, task.id)}
                      open={openId === task.id}
                      confirming={confirmId === task.id}
                      onToggleOpen={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
                      onMove={(dir) => moveTask(i, dir)}
                      onToggleDay={(d) => toggleDay(task.id, d)}
                      onAllDays={() => allDays(task.id)}
                      onAskDelete={() => askDelete(task.id)}
                      onCancelDelete={() => setConfirmId(null)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </ul>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addTask();
                }}
                className="border-t border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setAddError(null);
                    }}
                    placeholder="Add a task…"
                    maxLength={MAX_NAME_LEN}
                    enterKeyHint="done"
                    aria-label="New task name"
                    aria-invalid={addError ? true : undefined}
                    className="min-h-[40px] w-full rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={adding || draft.trim() === ""}
                    aria-label="Add task"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-[#10140d] transition-all duration-200 active:scale-95 disabled:opacity-40"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {addError && (
                  <p className="mt-2 animate-fade-in font-mono text-xs text-clay-strong" role="alert">
                    {addError}
                  </p>
                )}
              </form>
            </div>
          </section>

          <section aria-labelledby="week-heading">
            <SectionHead id="week-heading" title="Week" count={`${plural(slots, "task")} a week`} />
            {tasks.length > 0 && slots === 0 && (
              <p className="mb-3 animate-fade-in rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-mono text-xs text-clay-strong">
                No task is on a day yet. Open a task and pick its days.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DAYS.map((day) => (
                <DayPlan
                  key={day}
                  day={day}
                  ids={schedule[day] ?? []}
                  byId={byId}
                  onMove={(index, dir) => moveInDay(day, index, dir)}
                  onRemove={(id) => setDays(id, daysOf(id).filter((d) => d !== day))}
                />
              ))}
            </div>
          </section>
        </main>
      )}
    </ManageFrame>
  );
}

function SectionHead({ id, title, count }: { id: string; title: string; count: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
        {title}
      </h2>
      <span className="font-mono text-[11px] text-ink-faint">{count}</span>
    </div>
  );
}

/** Up and down, stacked, each a full-size tap target. */
function Arrows({
  label,
  upDisabled,
  downDisabled,
  onMove,
}: {
  label: string;
  upDisabled: boolean;
  downDisabled: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const btn =
    "flex h-[22px] w-8 items-center justify-center rounded-md text-ink-faint transition-colors duration-200 hover:text-ink active:bg-white/[0.08] disabled:opacity-20";
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" onClick={() => onMove(-1)} disabled={upDisabled} aria-label={`Move ${label} up`} className={btn}>
        <ChevronUp size={15} />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={downDisabled} aria-label={`Move ${label} down`} className={btn}>
        <ChevronDown size={15} />
      </button>
    </div>
  );
}

function TaskItem({
  task,
  index,
  count,
  days,
  isFull,
  open,
  confirming,
  onToggleOpen,
  onMove,
  onToggleDay,
  onAllDays,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  task: PlanTask;
  index: number;
  count: number;
  days: DayIndex[];
  isFull: (day: DayIndex) => boolean;
  open: boolean;
  confirming: boolean;
  onToggleOpen: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggleDay: (day: DayIndex) => void;
  onAllDays: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="animate-fade-in border-b border-border last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Arrows label={task.name} upDisabled={index === 0} downDisabled={index === count - 1} onMove={onMove} />

        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05]"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-ink">{task.name}</span>
            <span
              className={`block truncate font-mono text-[10px] ${days.length === 0 ? "text-clay-strong" : "text-ink-faint"}`}
            >
              {daysSummary(days)}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-ink-faint transition-transform duration-300 ease-spring ${open ? "rotate-180" : ""}`}
          />
        </button>

        {confirming ? (
          <div className="flex shrink-0 animate-fade-in items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-clay/40 bg-clay/10 px-2.5 py-2 font-mono text-[11px] text-clay-strong transition-all duration-200 active:scale-95"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              aria-label="Keep this task"
              className="rounded-lg p-2 text-ink-faint transition-colors hover:text-ink active:scale-90"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskDelete}
            aria-label={`Delete ${task.name}`}
            className="shrink-0 rounded-lg p-2.5 text-ink-faint transition-all duration-200 hover:text-clay-strong active:scale-90"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <Collapse open={open}>
        <div className="border-t border-border bg-black/10 px-3 pb-3 pt-3">
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onToggleDay(d)}
                  aria-pressed={on}
                  aria-label={DAY_LABELS[d]}
                  className={`flex h-11 items-center justify-center rounded-lg border font-mono text-[10px] uppercase tracking-wide transition-all duration-200 active:scale-95 ${
                    on
                      ? "border-accent bg-accent font-semibold text-[#10140d]"
                      : `border-border text-ink-muted hover:border-border-strong ${isFull(d) ? "opacity-40" : ""}`
                  }`}
                >
                  {DAY_SHORT_LABELS[d]}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[11px]">
            <span className="text-ink-faint">
              {days.length === 0 ? "Not on any day yet" : `On ${plural(days.length, "day")}`}
            </span>
            <button
              type="button"
              onClick={onAllDays}
              className="rounded-md px-1.5 py-1 text-accent-strong transition-colors duration-200 hover:text-ink active:scale-95"
            >
              {days.length === 7 ? "Clear all" : "Every day"}
            </button>
          </div>
        </div>
      </Collapse>
    </li>
  );
}

function DayPlan({
  day,
  ids,
  byId,
  onMove,
  onRemove,
}: {
  day: DayIndex;
  ids: string[];
  byId: Map<string, PlanTask>;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl2 border border-border bg-surface">
      <div className="flex items-center justify-between bg-surface-2 px-4 py-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">{DAY_LABELS[day]}</h3>
        <span className="font-mono text-[10px] text-ink-faint">{plural(ids.length, "task")}</span>
      </div>
      {ids.length === 0 ? (
        <p className="px-4 py-6 text-center font-mono text-xs text-ink-faint">Rest day. No tasks.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 py-2.5">
          {ids.map((id, i) => {
            const name = byId.get(id)?.name ?? "";
            return (
              <li
                key={id}
                className="flex animate-fade-in items-center gap-1 rounded-lg px-1 transition-colors duration-200 hover:bg-white/[0.03]"
              >
                <Arrows
                  label={name}
                  upDisabled={i === 0}
                  downDisabled={i === ids.length - 1}
                  onMove={(dir) => onMove(i, dir)}
                />
                <span className="min-w-0 flex-1 truncate px-1 font-mono text-sm text-ink">{name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label={`Take ${name} off ${DAY_LABELS[day]}`}
                  className="shrink-0 rounded-lg p-2.5 text-ink-faint transition-all duration-200 hover:text-clay-strong active:scale-90"
                >
                  <X size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
