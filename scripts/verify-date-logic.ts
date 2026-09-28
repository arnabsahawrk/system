import { getAppDayIndex, getAppDateKey, getAppWeekStartDateKey } from "../lib/date";
import { DAY_LABELS } from "../lib/types";

const TZ = "Asia/Dhaka";

function check(label: string, isoLocal: string) {
  // isoLocal is a wall-clock time we pretend is "now" in Asia/Dhaka (UTC+6),
  // so we build the real UTC instant by subtracting 6 hours.
  const asIfUtc = new Date(isoLocal + "Z");
  const now = new Date(asIfUtc.getTime() - 6 * 60 * 60 * 1000);
  const idx = getAppDayIndex(now, TZ);
  console.log(
    `${label.padEnd(42)} -> today=${DAY_LABELS[idx]}`.padEnd(70) +
      `weekStart=${getAppWeekStartDateKey(now, TZ)}` +
      `  appDate=${getAppDateKey(now, TZ)}`
  );
}

check("Fri 23:59 (deep in Friday)", "2026-10-02T23:59:00");
check("Sat 00:00 (just past midnight)", "2026-10-03T00:00:00");
check("Sat 03:00 (still 'Friday' per spec)", "2026-10-03T03:00:00");
check("Sat 05:59 (last second of 'Friday')", "2026-10-03T05:59:00");
check("Sat 06:00 (flips to new week NOW)", "2026-10-03T06:00:00");
check("Sat 06:01", "2026-10-03T06:01:00");
check("Sat 14:00 (midday Saturday)", "2026-10-03T14:00:00");
check("Tue 05:00 (still 'Monday')", "2026-10-06T05:00:00");
check("Tue 06:00 (flips to Tuesday)", "2026-10-06T06:00:00");
check("Tue 14:00 (midday Tuesday)", "2026-10-06T14:00:00");
