import { createBurst, particleAlpha, stepParticles } from "./confetti-engine";
import type { Particle } from "./confetti-engine";
import { prefersReducedMotion } from "./motion";

/**
 * A short burst of confetti for finishing a day. One full-screen, click-
 * through <canvas> is created when a burst starts and removed again when the
 * last piece has faded, so nothing is left sitting over the page. Skipped
 * entirely for people who ask their device for reduced motion.
 */

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let lastFrame = 0;
let lastFired = -Infinity;
let ratio = 1;
let timers: number[] = [];

function mount(): boolean {
  if (canvas && ctx) return true;
  const el = document.createElement("canvas");
  const context = el.getContext("2d");
  if (!context) return false;
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(window.innerWidth * ratio);
  el.height = Math.round(window.innerHeight * ratio);
  el.setAttribute("data-confetti", "");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:90;";
  document.body.appendChild(el);
  canvas = el;
  ctx = context;
  return true;
}

function unmount() {
  cancelAnimationFrame(raf);
  raf = 0;
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  particles = [];
  canvas?.remove();
  canvas = null;
  ctx = null;
}

function draw() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.globalAlpha = particleAlpha(p);
    ctx.fillStyle = p.color;
    if (p.round) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // squash the height with a cosine so each piece appears to tumble
      const flip = Math.max(0.15, Math.abs(Math.cos(p.age * 0.17 + p.phase)));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, flip);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function frame(now: number) {
  if (!canvas) return;
  // Cap dt so a stalled tab doesn't teleport the pieces when it wakes up.
  const dt = Math.min(2.5, (now - lastFrame) / (1000 / 60));
  lastFrame = now;
  particles = stepParticles(particles, dt, canvas.height, ratio);
  draw();
  if (particles.length > 0 || timers.length > 0) {
    raf = requestAnimationFrame(frame);
  } else {
    unmount();
  }
}

function launch(x: number, y: number, count: number, spread: number, power: number) {
  if (!canvas) return;
  particles.push(
    ...createBurst({ x: x * ratio, y: y * ratio, count, spread, power, scale: ratio })
  );
}

/** Fire a burst from a viewport point (defaults to the middle of the screen). */
export function fireConfetti(origin?: { x: number; y: number }): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (prefersReducedMotion()) return;
  const now = performance.now();
  if (now - lastFired < 1200) return; // one celebration at a time
  lastFired = now;
  if (!mount()) return;

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.45;

  // A tight upward fan first, then a wider, lower puff a beat later — it reads
  // as one burst that opens up rather than a single flat spray.
  launch(x, y, 72, 1.9, 17);
  const t = window.setTimeout(() => {
    timers = timers.filter((id) => id !== t);
    launch(x, y, 44, 3.1, 12);
  }, 150);
  timers.push(t);

  if (!raf) {
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/** Burst from the centre of an element (a checkbox, a card header...). */
export function fireConfettiFrom(el: Element | null): void {
  if (!el) return fireConfetti();
  const r = el.getBoundingClientRect();
  fireConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
}
