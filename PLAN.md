# System — plan and status

## This round

- Deleted the Chart/Trend feature and its file entirely; Tracker is now a tabless "Records" section.
- Replaced the 3-icon header with `components/sidebar.tsx`, a slide-in drawer (Lock App / Manage Tasks / Settings / credit line).
- `components/settings-sheet.tsx` reordered (email, system, passcode) and given its own `pausePasscode` field separate from the change-passcode fields; `Switch` rebuilt with verified geometry + `overflow-hidden`.
- Icon generation split: `public/icon-rounded-source.svg` → the manifest's `"any"`-purpose icons (Windows, no OS masking); `public/icon-source.svg` (full-bleed, unchanged) → `"maskable"` + apple-touch-icon, where the OS does the rounding itself.
- `scripts/seed.ts`: `HISTORY_PERCENTS` is now a generated 40-length array (gentle random walk) instead of a hardcoded 6-item list.
- Animation additions: `animate-fade-in` on page-level content, `shake` keyframe on a wrong passcode, `active:scale-95`-style press feedback on buttons, slide/fade transition on the settings sheet open+close.

## Verified this round — in a real browser, not just by reading code

Set up Playwright (a real headless Chromium was already available in the sandbox at `/opt/pw-browsers`) and drove the actual built-and-served app:

- Dashboard renders with the new hamburger menu; sidebar opens, shows Lock App only once a passcode exists, in the requested order.
- Settings: toggle geometry confirmed fixed by screenshot (previous fix was logic-only, unverified); section order confirmed; setting a passcode through the real form correctly reveals the dedicated System passcode field and the Change/Remove layout.
- Unlock page renders correctly end to end: filled the form, submitted, landed back on the dashboard.
- Records: confirmed Week 41 (live) at the top of 40 seeded weeks, Tasks column before Done, "Load 10 more" visible and — clicked it — correctly appended 10 more rows (21 total), proving pagination works through the real UI, not just the API in isolation.

This is a meaningfully different (stronger) verification bar than earlier rounds, which were mostly `tsc`/`next build`/direct API calls. Worth continuing to use for UI-affecting changes going forward.

### A process mistake worth recording

Partway through this round I ran `tsc`/tests against `next start` without rebuilding first, and spent a few cycles confused by screenshots showing stale UI. `next start` serves whatever `.next/` currently holds — it is not a dev server and does not pick up source changes. Rebuild before every `next start` when verifying a change.

## Not verified

- Live Brevo send, Neon, Vercel deploy/cron.
- Pause/resume through the actual UI buttons this round specifically (verified via direct library calls in the previous round; the UI wiring to those same endpoints is straightforward but wasn't re-screenshotted here).
- The Records table's horizontal scroll on an actual touchscreen (confirmed the container is scrollable in code; a mouse-driven headless browser doesn't really exercise a touch swipe).

## Next (unchanged from before, still parked)

1. Yearly heatmap, week streaks, best-week stat — discussed in detail, not yet decided/built.
2. Offline service worker (app-shell only, not offline ticking).
3. True drag-and-drop for task reordering, if the arrow buttons feel insufficient.
