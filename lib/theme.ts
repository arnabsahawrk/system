/**
 * Turns a completion percentage into a color and a message. The message
 * bands are fixed (given, word for word — no emoji except 100%, by
 * request); the color is a smooth interpolation so the weekly card, the
 * tracker table, and the email don't jump between flat colors at each
 * band boundary.
 */

export interface ProgressBand {
  min: number; // inclusive
  max: number; // inclusive
  message: string;
}

export const PROGRESS_BANDS: ProgressBand[] = [
  { min: 0, max: 19, message: "Let's do better next week" },
  { min: 20, max: 39, message: "A promising week" },
  { min: 40, max: 59, message: "A solid week" },
  { min: 60, max: 79, message: "A very good week" },
  { min: 80, max: 89, message: "An excellent week" },
  { min: 90, max: 99, message: "An exceptional week" },
  { min: 100, max: 100, message: "Holy moly \u{1F631}" },
];

export function getProgressMessage(percent: number): string {
  const p = clampPercent(percent);
  const band = PROGRESS_BANDS.find((b) => p >= b.min && p <= b.max);
  // PROGRESS_BANDS is a non-empty literal, so index 0 always exists.
  return (band ?? PROGRESS_BANDS[0]!).message;
}

function clampPercent(p: number): number {
  if (Number.isNaN(p)) return 0;
  return Math.min(100, Math.max(0, Math.round(p)));
}

// Red at 0%, green at 100% — a plain traffic-light read (can't complete it
// = red signal, fully complete = green signal) — with clay and olive as
// the in-between stops, keeping the app's existing earthy palette rather
// than a stock red-yellow-green.
const COLOR_STOPS: { stop: number; rgb: [number, number, number] }[] = [
  { stop: 0, rgb: [156, 74, 60] }, // brick red
  { stop: 33, rgb: [196, 120, 68] }, // clay / orange
  { stop: 66, rgb: [180, 168, 70] }, // olive
  { stop: 100, rgb: [107, 142, 80] }, // sage green
];

/** Returns a "rgb(r, g, b)" string for the given percent, 0–100. */
export function getProgressColor(percent: number): string {
  const p = clampPercent(percent);
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i]!;
    const b = COLOR_STOPS[i + 1]!;
    if (p >= a.stop && p <= b.stop) {
      const range = b.stop - a.stop || 1;
      const t = (p - a.stop) / range;
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1]!.rgb;
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/** A soft (14% alpha) tint of the same color, for card backgrounds/rows. */
export function getProgressTint(percent: number): string {
  const match = getProgressColor(percent).match(/\d+/g);
  if (!match || match.length < 3) return "rgba(255,255,255,0.05)";
  const [r, g, b] = match;
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}
