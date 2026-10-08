/**
 * The physics of the confetti, kept free of the DOM so it can be checked in
 * isolation (scripts/verify-logic.ts). Units: pixels and animation frames at
 * 60fps; `dt` is "how many 60fps frames passed", so a slow frame just moves
 * things further instead of slowing the whole effect down.
 */

/** The app's own palette — sage, clay, cream — plus one warm gold so the
 * burst glints against the dark surface without looking like a toy. */
export const CONFETTI_COLORS = ["#7c9468", "#a2bd86", "#c17a4e", "#d99a70", "#ede6d8", "#d8b45a", "#b9d3a0"];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
  phase: number;
  /** Frames lived so far. */
  age: number;
  /** Frames it lives for. */
  ttl: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  /** Centre of the fan in radians; -PI/2 is straight up. */
  angle?: number;
  /** Total width of the fan in radians. */
  spread?: number;
  /** Typical launch speed, px per frame. */
  power?: number;
  /** Multiplies sizes and speeds — pass the device pixel ratio so a burst
   * looks the same on a 2x screen. */
  scale?: number;
  colors?: string[];
  rand?: () => number;
}

/** Air drag per frame (paper flutters down, it doesn't plummet) and gravity. */
export const DRAG = 0.94;
export const GRAVITY = 0.3;

export function createBurst(opts: BurstOptions): Particle[] {
  const {
    x,
    y,
    count,
    angle = -Math.PI / 2,
    spread = Math.PI / 2,
    power = 16,
    scale = 1,
    colors = CONFETTI_COLORS,
    rand = Math.random,
  } = opts;

  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const heading = angle + (rand() - 0.5) * spread;
    const speed = power * scale * (0.55 + rand() * 0.9);
    const round = rand() < 0.28;
    out.push({
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      rot: rand() * Math.PI * 2,
      vr: (rand() - 0.5) * 0.4,
      w: (round ? 5 + rand() * 3 : 7 + rand() * 5) * scale,
      h: (round ? 5 + rand() * 3 : 4 + rand() * 3) * scale,
      color: colors[Math.floor(rand() * colors.length) % colors.length]!,
      round,
      phase: rand() * Math.PI * 2,
      age: 0,
      ttl: 110 + rand() * 70,
    });
  }
  return out;
}

/** Advances every particle by `dt` frames and returns the ones still alive
 * (a new array; the particles themselves are updated in place). */
export function stepParticles(particles: Particle[], dt: number, height: number, scale = 1): Particle[] {
  const drag = Math.pow(DRAG, dt);
  const survivors: Particle[] = [];
  for (const p of particles) {
    p.vx *= drag;
    p.vy = p.vy * drag + GRAVITY * scale * dt;
    // a little side-to-side flutter, like paper
    p.x += p.vx * dt + Math.sin(p.age * 0.15 + p.phase) * 0.55 * scale * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.age += dt;
    if (p.age < p.ttl && p.y < height + 40 * scale) survivors.push(p);
  }
  return survivors;
}

/** Fully opaque for the first ~65% of a particle's life, then fades out. */
export function particleAlpha(p: Particle): number {
  const t = p.age / p.ttl;
  if (t <= 0.65) return 1;
  return Math.max(0, 1 - (t - 0.65) / 0.35);
}
