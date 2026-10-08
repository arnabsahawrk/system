import { DAY_LABELS, DAY_SHORT_LABELS } from "./types";
import type { DayEntry, DayIndex, Verdict } from "./types";
import { getProgressColor, getProgressMessage } from "./theme";
import { parseDateKey } from "./date";
import { TARGET_PERCENT, TASK_WINDOW_WEEKS } from "./goals";

/**
 * Weekly summary email, sent once — right at the Saturday-6am rollover,
 * covering the week that just ended, before the new week's data exists.
 *
 * Provider: Brevo (brevo.com), free tier — 300 emails/day, no card needed.
 * REST call only (no SDK): one endpoint, keeps the dependency list small
 * and behaves identically on Vercel's serverless functions and the daily
 * cron ping.
 */

export interface FinishedWeekData {
  weekNumber: number;
  startDateKey: string; // Saturday, YYYY-MM-DD
  endDateKey: string; // Friday, YYYY-MM-DD
  days: DayEntry[]; // 7 entries, Sat..Fri, as they stood at rollover
  completed: number;
  total: number;
  percent: number;
  /** How the week compares with the ones around it. Optional on purpose: if
   * it can't be worked out, the email still goes out exactly as before. */
  verdict?: Verdict | null;
}

function formatDateLabel(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MINUS = "\u2212";

/** "+6 vs Week 11" / "\u22123 vs Week 11" / "same as Week 11" — null when there
 * is no previous week to compare with. */
function deltaPhrase(v: Verdict | null | undefined): string | null {
  if (!v || v.delta === null || !v.prevWeek) return null;
  if (v.delta > 0) return `+${v.delta} vs Week ${v.prevWeek.weekNumber}`;
  if (v.delta < 0) return `${MINUS}${Math.abs(v.delta)} vs Week ${v.prevWeek.weekNumber}`;
  return `same as Week ${v.prevWeek.weekNumber}`;
}

function streakPhrase(v: Verdict | null | undefined): string | null {
  if (!v || v.weekStreak < 2) return null;
  return `${v.weekStreak} weeks in a row at ${TARGET_PERCENT}% or more`;
}

/** A task is only called out while it still has room to improve. */
function weakestPhrase(v: Verdict | null | undefined): { label: string; text: string } | null {
  const t = v?.weakestTask;
  if (!t || t.percent >= 100) return null;
  return {
    label: t.percent >= TARGET_PERCENT ? "Weakest task" : "Needs attention",
    text: `${t.name} \u2014 ${t.percent}% over the last ${TASK_WINDOW_WEEKS} weeks (${t.done} of ${t.total})`,
  };
}

/** Seven colored table cells — email clients strip SVG and scripts, but a
 * plain table with background colors renders everywhere. A rest day gets a
 * neutral cell, never the red of a 0% day. */
function renderDayStrip(v: Verdict): string {
  const cells = v.dayStats
    .map((d) => {
      const pct = d.total === 0 ? null : Math.round((d.done / d.total) * 100);
      const bg = pct === null ? "#ece7dc" : getProgressColor(pct);
      return `<td width="14%" height="26" style="height:26px;background:${bg};border-radius:6px;font-size:1px;line-height:1px;">&nbsp;</td>`;
    })
    .join("");
  const labels = v.dayStats
    .map((d, i) => {
      const count = d.total === 0 ? "rest" : `${d.done}/${d.total}`;
      return `<td align="center" style="padding-top:5px;font-family:'Courier New',monospace;font-size:10px;line-height:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;">${DAY_SHORT_LABELS[i as DayIndex]}<br /><span style="letter-spacing:0;text-transform:none;color:#6b6b6b;">${count}</span></td>`;
    })
    .join("");
  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:separate;border-spacing:4px 0;">
                  <tr>${cells}</tr>
                  <tr>${labels}</tr>
                </table>`;
}

export function renderWeeklySummaryEmail(week: FinishedWeekData): {
  subject: string;
  html: string;
  text: string;
} {
  const message = getProgressMessage(week.percent);
  const color = getProgressColor(week.percent);
  const dateRange = `${formatDateLabel(week.startDateKey)} \u2013 ${formatDateLabel(week.endDateKey)}`;
  const delta = deltaPhrase(week.verdict);
  const streak = streakPhrase(week.verdict);
  const weakest = weakestPhrase(week.verdict);
  const subject = `System \u2014 Week ${week.weekNumber}: ${week.percent}%${delta ? ` (${delta})` : ""} \u2014 ${message}`;

  const deltaColor =
    !week.verdict || week.verdict.delta === null
      ? "#8a8a8a"
      : week.verdict.delta > 0
        ? "#3f8f52"
        : week.verdict.delta < 0
          ? "#b3413f"
          : "#8a8a8a";
  const deltaArrow =
    !week.verdict || week.verdict.delta === null || week.verdict.delta === 0
      ? ""
      : week.verdict.delta > 0
        ? "&#9650; "
        : "&#9660; ";

  const dayRows = week.days
    .map((day) => {
      const doneCount = day.tasks.filter((t) => t.completed).length;
      const taskList = day.tasks
        .map((t) => {
          const mark = t.completed ? "&#10003;" : "&#10007;";
          const markColor = t.completed ? "#3f8f52" : "#b3413f";
          return `<span style="display:inline-block;margin:0 10px 4px 0;font-size:13px;color:#3a3a3a;white-space:nowrap;">
            <span style="color:${markColor};font-weight:700;">${mark}</span>
            ${escapeHtml(t.name)}
          </span>`;
        })
        .join("");
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ececec;vertical-align:top;">
            <div style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8a8a;margin-bottom:4px;">
              ${DAY_LABELS[day.dayIndex]} &middot; ${formatDateLabel(day.dateKey)} &middot; ${doneCount}/${day.tasks.length}
            </div>
            <div>${taskList || '<span style="font-size:13px;color:#b3b3b3;">Rest day — no tasks set</span>'}</div>
          </td>
        </tr>`;
    })
    .join("");

  const textLines = [
    `SYSTEM \u2014 Week ${week.weekNumber} (${dateRange})`,
    `${week.completed}/${week.total} goals \u2014 ${week.percent}% \u2014 ${message}`,
    ...(delta ? [`Change: ${delta}`] : []),
    ...(streak ? [`Streak: ${streak}`] : []),
    ...(weakest ? [`${weakest.label}: ${weakest.text}`] : []),
    "",
    ...week.days.map((day) => {
      const doneCount = day.tasks.filter((t) => t.completed).length;
      const taskBits = day.tasks.map((t) => `${t.completed ? "[x]" : "[ ]"} ${t.name}`).join("  ");
      return `${DAY_LABELS[day.dayIndex]} (${formatDateLabel(day.dateKey)}) \u2014 ${doneCount}/${
        day.tasks.length
      }: ${taskBits || "rest day — no tasks set"}`;
    }),
    "",
    "A project by Arnab Saha \u2014 https://arnabsaha.vercel.app/",
  ];

  const verdictBlock = week.verdict
    ? `
                <div style="text-align:center;margin:-6px 0 18px;">
                  ${
                    delta
                      ? `<div style="font-size:13px;font-weight:600;color:${deltaColor};">${deltaArrow}${escapeHtml(delta)}</div>`
                      : ""
                  }
                  ${
                    streak
                      ? `<div style="font-size:12px;color:#6b6b6b;margin-top:3px;">${escapeHtml(streak)}</div>`
                      : ""
                  }
                </div>
                ${renderDayStrip(week.verdict)}
                ${
                  weakest
                    ? `<div style="margin:0 0 16px;padding:11px 14px;background:#f4efe4;border-radius:10px;font-size:13px;line-height:18px;color:#3a3a3a;">
                  <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#a2734d;margin-bottom:2px;">${escapeHtml(weakest.label)}</div>
                  ${escapeHtml(weakest.text)}
                </div>`
                    : ""
                }`
    : "";

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:0;background:#eee9e0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eee9e0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2dccd;">
            <tr>
              <td style="background:#171310;padding:24px 28px;">
                <div style="font-family:'Courier New',monospace;color:#a2bd86;font-size:13px;letter-spacing:0.35em;text-transform:uppercase;">SYSTEM</div>
                <div style="color:#9c9c9c;font-size:12px;margin-top:4px;">Week ${week.weekNumber} &middot; ${dateRange}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="text-align:center;margin-bottom:20px;">
                  <div style="font-size:40px;font-weight:700;color:${color};line-height:1;">${week.percent}%</div>
                  <div style="font-size:13px;color:#6b6b6b;margin-top:4px;">${week.completed} of ${week.total} goals completed</div>
                  <div style="display:inline-block;margin-top:12px;padding:6px 14px;border-radius:999px;background:${color};color:#111;font-size:13px;font-weight:600;">
                    ${escapeHtml(message)}
                  </div>
                </div>${verdictBlock}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${dayRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f4efe4;border-top:1px solid #e2dccd;text-align:center;">
                <div style="font-size:11px;color:#a3a3a3;">
                  A project by
                  <a href="https://arnabsaha.vercel.app/" style="color:#a2734d;text-decoration:none;">Arnab Saha</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text: textLines.join("\n") };
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Low-level Brevo call, shared by the weekly summary and the passcode
 * "forgot passcode" recovery email. Returns false instead of throwing on
 * failure so a bad send never crashes the request that triggered it. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !fromEmail) return false;

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || "System", email: fromEmail },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendWeeklySummaryEmail(week: FinishedWeekData, toEmail: string): Promise<boolean> {
  const { subject, html, text } = renderWeeklySummaryEmail(week);
  return sendEmail({ to: toEmail, subject, html, text });
}
