import { angleDistance, base, clamp, rand, TAU, validDt, type MotionBase, type MotionInput } from './common';

export interface Ring {
  r: number;
  gap: number;
  spin: number;
}
export interface TiltState extends MotionBase {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  rings: Ring[];
  level: number;
  timeLeft: number;
  /** Drag fallback for web or devices without an accelerometer. */
  pull: { x: number; y: number } | null;
}
export const TILT = { ball: 7, gapHalf: 0.42, wall: 3, exit: 150, accel: 520, drag: 1.4, bounce: 0.45 };
const C = 160;

export function levelTime(level: number) {
  return Math.max(7, 16 - level * 0.8);
}
function build(s: TiltState) {
  const speed = 0.4 + Math.min(s.level, 12) * 0.12;
  s.rings = [50, 90, 130].map((r, i) => ({
    r,
    gap: rand(s) * TAU,
    spin: speed * (i % 2 ? -1 : 1) * (0.8 + rand(s) * 0.4),
  }));
  s.x = C;
  s.y = C;
  s.vx = 0;
  s.vy = 0;
  s.timeLeft = levelTime(s.level);
}
export function createTilt(seed: number): TiltState {
  const s: TiltState = {
    ...base(seed),
    x: C,
    y: C,
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    rings: [],
    level: 1,
    timeLeft: 0,
    pull: null,
  };
  build(s);
  return s;
}
export function inGap(ring: Ring, angle: number) {
  return angleDistance(angle, ring.gap) < TILT.gapHalf - TILT.ball / ring.r;
}
export function stepTilt(state: TiltState, rawDt: number): TiltState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: TiltState = { ...state, perfect: false, timeLeft: state.timeLeft - dt };
  s.rings = state.rings.map((g) => ({ ...g, gap: g.gap + g.spin * dt }));
  const [ax, ay] = s.pull ? [(s.pull.x - C) / 90, (s.pull.y - C) / 90] : [s.ax, s.ay];
  const damp = Math.exp(-TILT.drag * dt);
  s.vx = (s.vx + clamp(ax, -1, 1) * TILT.accel * dt) * damp;
  s.vy = (s.vy + clamp(ay, -1, 1) * TILT.accel * dt) * damp;
  const prevR = Math.hypot(state.x - C, state.y - C);
  let nx = s.x + s.vx * dt;
  let ny = s.y + s.vy * dt;
  let r = Math.hypot(nx - C, ny - C);
  const a = Math.atan2(ny - C, nx - C);
  for (const g of s.rings) {
    const reach = TILT.ball + TILT.wall;
    const inside = prevR < g.r;
    const hits = inside ? r > g.r - reach : r < g.r + reach;
    if (!hits || (inside ? prevR > g.r - reach : prevR < g.r + reach) || inGap(g, a)) continue;
    // Reflect the radial component and keep the tangential one so the ball rolls along the wall.
    const ux = (nx - C) / (r || 1);
    const uy = (ny - C) / (r || 1);
    const vr = s.vx * ux + s.vy * uy;
    s.vx -= (1 + TILT.bounce) * vr * ux;
    s.vy -= (1 + TILT.bounce) * vr * uy;
    r = inside ? g.r - reach : g.r + reach;
    nx = C + ux * r;
    ny = C + uy * r;
  }
  s.x = nx;
  s.y = ny;
  if (r > TILT.exit) {
    s.perfect = s.timeLeft > levelTime(s.level) / 2;
    s.score += 1;
    s.level += 1;
    s.note = s.perfect ? 'Speed escape!' : `Level ${s.level}`;
    build(s);
  } else if (s.timeLeft <= 0) {
    s.phase = 'over';
    s.note = 'Out of time';
  }
  return s;
}
export function inputTilt(state: TiltState, ev: MotionInput): TiltState {
  if (state.phase !== 'running' || ev.type === 'action' || ev.type === 'touches') return state;
  if (ev.type === 'tilt') return { ...state, ax: ev.x, ay: ev.y };
  if (ev.type === 'up') return { ...state, pull: null };
  return { ...state, pull: { x: ev.x, y: ev.y } };
}
