"use client";

import { getProgressColor } from "@/lib/theme";
import { useArmed } from "@/lib/use-armed";

/** Small circular progress indicator — used in the weekly card (one per day)
 * and the Records rows. It fills in when it first appears and glides to a new
 * value (and colour) when the percentage changes. */
export function DayRing({
  percent,
  size = 30,
  strokeWidth = 3.5,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const armed = useArmed();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const dash = armed ? (clamped / 100) * circumference : 0;
  const color = getProgressColor(clamped);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          stroke: color,
          strokeDasharray: `${dash} ${circumference - dash}`,
          transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease",
        }}
      />
    </svg>
  );
}
