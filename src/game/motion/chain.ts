import { base, dist, FIELD, rand, validDt, type MotionBase, type MotionInput } from './common';

export interface ChainDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** -1 while drifting, otherwise seconds since this dot exploded. */
  blast: number;
  color: number;
}
export interface ChainState extends MotionBase {
  level: number;
  dots: ChainDot[];
  goal: number;
  popped: number;
  mode: 'aim' | 'blasting' | 'cleared';
  wait: number;
}
export const CHAIN = { dot: 6, blastR: 30, grow: 0.3, hold: 0.9, shrink: 0.3 };
export const CHAIN_COLORS = ['#FF8A4C', '#B48CFF', '#5AC8FA', '#C8F560', '#FF5E7E'];
const LIFE = CHAIN.grow + CHAIN.hold + CHAIN.shrink;

export function blastRadius(t: number) {
  if (t < 0) return 0;
  if (t < CHAIN.grow) return (CHAIN.blastR * t) / CHAIN.grow;
  if (t < CHAIN.grow + CHAIN.hold) return CHAIN.blastR;
  return Math.max(0, (CHAIN.blastR * (LIFE - t)) / CHAIN.shrink);
}
export function levelSpec(level: number) {
  const count = Math.min(10 + level * 3, 55);
  return { count, goal: Math.ceil(count * Math.min(0.25 + level * 0.06, 0.85)) };
}
function setup(s: ChainState) {
  const { count, goal } = levelSpec(s.level);
  s.goal = goal;
  s.popped = 0;
  s.mode = 'aim';
  s.dots = Array.from({ length: count }, () => {
    const a = rand(s) * Math.PI * 2;
    const v = 25 + rand(s) * 25;
    return {
      x: 15 + rand(s) * 290,
      y: 15 + rand(s) * 290,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      blast: -1,
      color: Math.floor(rand(s) * CHAIN_COLORS.length),
    };
  });
}
export function createChain(seed: number): ChainState {
  const s: ChainState = { ...base(seed), level: 1, dots: [], goal: 0, popped: 0, mode: 'aim', wait: 0 };
  setup(s);
  s.note = `Level 1 · pop ${s.goal}`;
  return s;
}
export function stepChain(state: ChainState, rawDt: number): ChainState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: ChainState = { ...state, perfect: false };
  if (s.mode === 'cleared') {
    s.wait -= dt;
    if (s.wait <= 0) {
      s.level += 1;
      setup(s);
      s.note = `Level ${s.level} · pop ${s.goal}`;
    }
    return s;
  }
  s.dots = state.dots.map((d) => {
    if (d.blast >= 0) return { ...d, blast: d.blast + dt };
    const n = { ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt };
    if (n.x < CHAIN.dot || n.x > FIELD - CHAIN.dot) n.vx = -n.vx;
    if (n.y < CHAIN.dot || n.y > FIELD - CHAIN.dot) n.vy = -n.vy;
    return n;
  });
  if (s.mode !== 'blasting') return s;
  const blasts = s.dots.filter((d) => d.blast >= 0 && d.blast < LIFE);
  for (const d of s.dots) {
    if (d.blast >= 0) continue;
    if (blasts.some((b) => dist(b.x, b.y, d.x, d.y) < blastRadius(b.blast) + CHAIN.dot)) {
      d.blast = 0;
      s.popped += 1;
      s.score += 1;
    }
  }
  if (blasts.length === 0) {
    if (s.popped >= s.goal) {
      s.mode = 'cleared';
      s.wait = 1.2;
      s.perfect = s.popped === s.dots.length - 1;
      s.note = s.perfect ? 'Total wipe!' : 'Level clear!';
    } else {
      s.phase = 'over';
      s.note = `${s.popped}/${s.goal} popped`;
    }
  }
  return s;
}
export function inputChain(state: ChainState, ev: MotionInput): ChainState {
  if (state.phase !== 'running' || state.mode !== 'aim' || ev.type !== 'down') return state;
  // The player's own spark is a dot that starts already exploding; it does not count toward the goal.
  const spark: ChainDot = { x: ev.x, y: ev.y, vx: 0, vy: 0, blast: 0, color: -1 };
  return { ...state, mode: 'blasting', dots: [...state.dots, spark], note: '' };
}
