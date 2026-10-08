import { base, clamp, dist, rand, validDt, type MotionBase, type MotionInput } from './common';

/**
 * Dot Duel: air hockey for two. Couples and friends share one phone (each owns a half),
 * or play against the bot. Paddles are driven by targets, so a remote player slots in the same way.
 */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface DuelState extends MotionBase {
  mode: 'bot' | 'duo';
  puck: Body;
  /** 0 = bottom (player one), 1 = top (player two or bot). */
  paddles: [Body, Body];
  targets: [{ x: number; y: number } | null, { x: number; y: number } | null];
  goals: [number, number];
  serve: number;
  winner: 0 | 1 | null;
}
export const DUEL = { paddle: 20, puck: 11, goalHalf: 55, win: 5, maxPuck: 560, paddleSpeed: 1100, botSpeed: 360 };

function center(s: DuelState, toward: 0 | 1) {
  s.puck = { x: 160, y: 160, vx: (rand(s) - 0.5) * 60, vy: toward === 0 ? 90 : -90 };
  s.serve = 0.8;
}
export function createDuel(seed: number): DuelState {
  const s: DuelState = {
    ...base(seed),
    mode: 'bot',
    puck: { x: 160, y: 160, vx: 0, vy: 0 },
    paddles: [
      { x: 160, y: 280, vx: 0, vy: 0 },
      { x: 160, y: 40, vx: 0, vy: 0 },
    ],
    targets: [null, null],
    goals: [0, 0],
    serve: 0,
    winner: null,
  };
  center(s, rand(s) < 0.5 ? 0 : 1);
  return s;
}
function botTarget(s: DuelState) {
  const p = s.puck;
  if (p.y < 175 && (p.vy < 40 || p.y < 90)) return { x: p.x, y: Math.max(p.y - DUEL.paddle, 25) };
  return { x: 160 + (p.x - 160) * 0.6, y: 45 };
}
function movePaddle(b: Body, target: { x: number; y: number } | null, side: 0 | 1, maxSpeed: number, dt: number) {
  const r = DUEL.paddle;
  const goal = target
    ? {
        x: clamp(target.x, r, 320 - r),
        y: side === 0 ? clamp(target.y, 160 + r, 320 - r) : clamp(target.y, r, 160 - r),
      }
    : { x: b.x, y: b.y };
  const dx = goal.x - b.x;
  const dy = goal.y - b.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * dt);
  const nx = d ? b.x + (dx / d) * step : b.x;
  const ny = d ? b.y + (dy / d) * step : b.y;
  return { x: nx, y: ny, vx: (nx - b.x) / dt, vy: (ny - b.y) / dt };
}
function hit(p: Body, b: Body) {
  const d = dist(p.x, p.y, b.x, b.y);
  const min = DUEL.paddle + DUEL.puck;
  if (d >= min || d === 0) return p;
  const nx = (p.x - b.x) / d;
  const ny = (p.y - b.y) / d;
  const out = { ...p, x: b.x + nx * min, y: b.y + ny * min };
  const rel = (p.vx - b.vx) * nx + (p.vy - b.vy) * ny;
  if (rel < 0) {
    out.vx -= 1.9 * rel * nx;
    out.vy -= 1.9 * rel * ny;
  }
  return out;
}
export function stepDuel(state: DuelState, rawDt: number): DuelState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: DuelState = { ...state, perfect: false };
  const top = s.mode === 'bot' ? botTarget(s) : s.targets[1];
  const botSpeed = DUEL.botSpeed + Math.max(0, s.goals[0] - s.goals[1]) * 40;
  s.paddles = [
    movePaddle(s.paddles[0], s.targets[0], 0, DUEL.paddleSpeed, dt),
    movePaddle(s.paddles[1], top, 1, s.mode === 'bot' ? botSpeed : DUEL.paddleSpeed, dt),
  ];
  if (s.serve > 0) {
    s.serve -= dt;
    return s;
  }
  const f = Math.exp(-0.35 * dt);
  let p: Body = { ...s.puck, vx: s.puck.vx * f, vy: s.puck.vy * f };
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  for (const b of s.paddles) p = hit(p, b);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > DUEL.maxPuck) {
    p.vx *= DUEL.maxPuck / sp;
    p.vy *= DUEL.maxPuck / sp;
  }
  const r = DUEL.puck;
  if (p.x < r || p.x > 320 - r) {
    p.x = clamp(p.x, r, 320 - r);
    p.vx = -p.vx * 0.9;
  }
  const inMouth = Math.abs(p.x - 160) < DUEL.goalHalf;
  if (!inMouth && (p.y < r || p.y > 320 - r)) {
    p.y = clamp(p.y, r, 320 - r);
    p.vy = -p.vy * 0.9;
  }
  s.puck = p;
  const scorer: 0 | 1 | null = p.y < -r ? 0 : p.y > 320 + r ? 1 : null;
  if (scorer !== null) {
    const goals: [number, number] = [...s.goals];
    goals[scorer] += 1;
    s.goals = goals;
    s.score = goals[0];
    s.perfect = scorer === 0;
    const names = s.mode === 'bot' ? ['You', 'Bot'] : ['Blue', 'Pink'];
    s.note = `${names[scorer]} scores! ${goals[0]}–${goals[1]}`;
    if (goals[scorer] >= DUEL.win) {
      s.phase = 'over';
      s.winner = scorer;
      s.note = `${names[scorer]} win${scorer === 0 && s.mode === 'bot' ? '' : 's'} ${goals[0]}–${goals[1]}`;
    } else center(s, scorer === 0 ? 1 : 0);
  }
  return s;
}
export function inputDuel(state: DuelState, ev: MotionInput): DuelState {
  if (state.phase !== 'running' || ev.type === 'tilt' || ev.type === 'action') return state;
  // Each finger steers the paddle in its own half; single-pointer events (mouse, web) map the same way.
  const points = ev.type === 'touches' ? ev.points : ev.type === 'up' ? [] : [{ x: ev.x, y: ev.y }];
  const targets: DuelState['targets'] = [null, null];
  for (const p of points) {
    const side = p.y >= 160 ? 0 : 1;
    if (side === 1 && state.mode === 'bot') continue;
    targets[side] = p;
  }
  // A lifted finger leaves the paddle where it is rather than snapping it home.
  if (ev.type === 'touches' || ev.type === 'up') return { ...state, targets };
  return { ...state, targets: [targets[0] ?? state.targets[0], targets[1] ?? state.targets[1]] };
}
