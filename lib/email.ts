import { DAY_LABELS } from "./types";
import type { DayEntry } from "./types";
import { getProgressColor, getProgressMessage } from "./theme";
import { parseDateKey } from "./date";

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

export function renderWeeklySummaryEmail(week: FinishedWeekData): {
  subject: string;
  html: string;
  text: string;
} {
  const message = getProgressMessage(week.percent);
  const color = getProgressColor(week.percent);
  const dateRange = `${formatDateLabel(week.startDateKey)} \u2013 ${formatDateLabel(week.endDateKey)}`;
  const subject = `System \u2014 Week ${week.weekNumber}: ${week.percent}% \u2014 ${message}`;

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
            <div>${taskList || '<span style="font-size:13px;color:#b3b3b3;">No tasks this day</span>'}</div>
          </td>
        </tr>`;
    })
    .join("");

  const textLines = [
    `SYSTEM \u2014 Week ${week.weekNumber} (${dateRange})`,
    `${week.completed}/${week.total} goals \u2014 ${week.percent}% \u2014 ${message}`,
    "",
    ...week.days.map((day) => {
      const doneCount = day.tasks.filter((t) => t.completed).length;
      const taskBits = day.tasks.map((t) => `${t.completed ? "[x]" : "[ ]"} ${t.name}`).join("  ");
      return `${DAY_LABELS[day.dayIndex]} (${formatDateLabel(day.dateKey)}) \u2014 ${doneCount}/${
        day.tasks.length
      }: ${taskBits || "no tasks"}`;
    }),
    "",
    "A project by Arnab Saha \u2014 https://arnabsaha.vercel.app/",
  ];

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
                </div>
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
