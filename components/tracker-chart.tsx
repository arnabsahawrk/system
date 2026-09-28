import { getProgressColor } from "@/lib/theme";
import type { WeekSummary } from "@/lib/types";

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

export function TrackerChart({ weeks }: { weeks: WeekSummary[] }) {
  const chronological = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = chronological.map((week, i) => {
    const x =
      chronological.length === 1
        ? PAD_LEFT + plotWidth / 2
        : PAD_LEFT + (i / (chronological.length - 1)) * plotWidth;
    const y = PAD_TOP + (1 - week.percent / 100) * plotHeight;
    return { x, y, week };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath =
    firstPoint && lastPoint
      ? `${linePath} L ${lastPoint.x} ${PAD_TOP + plotHeight} L ${firstPoint.x} ${
          PAD_TOP + plotHeight
        } Z`
      : "";

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" className="overflow-visible">
      <defs>
        <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c9468" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7c9468" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g) => {
        const y = PAD_TOP + (1 - g / 100) * plotHeight;
        return (
          <g key={g}>
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={WIDTH - PAD_RIGHT}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text x={0} y={y + 3} fontSize="9" fill="#8a8a92" fontFamily="ui-monospace, monospace">
              {g}%
            </text>
          </g>
        );
      })}

      {points.length > 1 && <path d={areaPath} fill="url(#chartFade)" />}
      {points.length > 1 && (
        <path d={linePath} fill="none" stroke="#7c9468" strokeWidth={2} />
      )}

      {points.map((p) => (
        <g key={p.week.weekNumber}>
          <circle cx={p.x} cy={p.y} r={4} fill={getProgressColor(p.week.percent)} />
          <text
            x={p.x}
            y={p.y - 10}
            fontSize="9"
            textAnchor="middle"
            fill="#c9c9cf"
            fontFamily="ui-monospace, monospace"
          >
            {p.week.percent}%
          </text>
          <text
            x={p.x}
            y={HEIGHT - 6}
            fontSize="9"
            textAnchor="middle"
            fill="#8a8a92"
            fontFamily="ui-monospace, monospace"
          >
            W{p.week.weekNumber}
          </text>
        </g>
      ))}
    </svg>
  );
}
