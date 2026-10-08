import { base, rand, validDt, type MotionBase, type MotionInput } from './common';

/** 0 up, 1 right, 2 down, 3 left. */
export type Dir = 0 | 1 | 2 | 3;
export const SWIPE_COLORS = ['#FF5E7E', '#5AC8FA', '#C8F560', '#FFC94D'] as const;
export interface SwipeState extends MotionBase {
  /** Color index shown on each gate, indexed by Dir. */
  gates: number[];
  color: number;
  /** Trick dots change to `trickTo` halfway through their window. */
  trickTo: number | null;
  timer: number;
  window: number;
  start: { x: number; y: number } | null;
  /** Where the last dot flew, for the exit animation. */
  fling: { dir: Dir; t: number } | null;
}
export function swipeWindow(score: number) {
  return Math.max(0.75, 2 - score * 0.035);
}
function shuffle(s: SwipeState) {
  const g = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [g[i], g[j]] = [g[j], g[i]];
  }
  return g;
}
function nextDot(s: SwipeState) {
  s.color = Math.floor(rand(s) * 4);
  s.trickTo = s.score >= 10 && rand(s) < 0.3 ? (s.color + 1 + Math.floor(rand(s) * 3)) % 4 : null;
  s.window = swipeWindow(s.score);
  s.timer = s.window;
  if (s.score > 0 && s.score % 8 === 0) {
    s.gates = shuffle(s);
    s.note = 'Gates shuffled!';
  }
}
export function createSwipe(seed: number): SwipeState {
  const s: SwipeState = {
    ...base(seed),
    gates: [0, 1, 2, 3],
    color: 0,
    trickTo: null,
    timer: 0,
    window: 0,
    start: null,
    fling: null,
  };
  nextDot(s);
  return s;
}
/** Color the player should match right now. */
export function visibleColor(s: SwipeState) {
  return s.trickTo !== null && s.timer < s.window / 2 ? s.trickTo : s.color;
}
export function stepSwipe(state: SwipeState, rawDt: number): SwipeState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s = { ...state, timer: state.timer - dt };
  if (s.fling) s.fling = s.fling.t + dt > 0.25 ? null : { ...s.fling, t: s.fling.t + dt };
  if (s.timer <= 0) {
    s.phase = 'over';
    s.note = 'Too slow';
  }
  return s;
}
export function swipeDir(dx: number, dy: number): Dir | null {
  if (Math.hypot(dx, dy) < 22) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
export function inputSwipe(state: SwipeState, ev: MotionInput): SwipeState {
  if (state.phase !== 'running') return state;
  if (ev.type === 'down') return { ...state, start: { x: ev.x, y: ev.y } };
  if (ev.type !== 'up' || !state.start) return state;
  const dir = swipeDir(ev.x - state.start.x, ev.y - state.start.y);
  if (dir === null) return { ...state, start: null };
  const s: SwipeState = { ...state, start: null, perfect: false, note: '' };
  if (s.gates[dir] !== visibleColor(s)) {
    s.phase = 'over';
    s.note = 'Wrong gate';
    return s;
  }
  s.perfect = s.timer > s.window * 0.65;
  s.score += 1;
  s.fling = { dir, t: 0 };
  nextDot(s);
  return s;
}
