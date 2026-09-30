"use client";

import { useEffect, useState } from "react";

/** Its own 1-second interval, isolated in a tiny component so the rest of
 * the dashboard doesn't re-render every second just for the clock. */
export function LiveClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <p className="font-mono text-[10px] text-ink-faint">{timeZone}</p>;

  const date = now.toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-GB", { timeZone, hour12: false });

  return (
    <p className="font-mono text-[10px] text-ink-faint">
      {date} &middot; {time} &middot; {timeZone}
    </p>
  );
}
