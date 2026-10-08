import { base, validDt, type MotionBase, type MotionInput } from './common';

/**
 * Dot Stack: hold to grow a ring from the centre, release to lock it just inside the last ring.
 * The closer you dare to go, the more it scores; touching the ring above ends the run.
 */
export interface StackState extends MotionBase {
  /** Locked ring radii, outermost first. */
  rings: number[];
  cur: number;
  holding: boolean;
  level: number;
  spin: number;
}
export const STACK = { outer: 150, thick: 6, minRoom: 26, minRing: 12 };

export function growSpeed(score: number, level: number) {
  return Math.min(80 + score * 2.2 + level * 12, 260);
}
export const ceiling = (s: StackState) => (s.rings.length ? s.rings[s.rings.length - 1] : STACK.outer);

export function createStack(seed: number): StackState {
  return { ...base(seed), rings: [], cur: 0, holding: false, level: 1, spin: 0 };
}
export function stepStack(state: StackState, rawDt: number): StackState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s = { ...state, spin: state.spin + dt };
  if (!s.holding) return s;
  s.cur += growSpeed(s.score, s.level) * dt;
  if (s.cur + STACK.thick > ceiling(s)) {
    s.phase = 'over';
    s.holding = false;
    s.note = 'Crashed into the stack';
  }
  return s;
}
export function inputStack(state: StackState, ev: MotionInput): StackState {
  if (state.phase !== 'running') return state;
  if (ev.type === 'down' && !state.holding) return { ...state, holding: true, cur: 0, note: '', perfect: false };
  if (ev.type !== 'up' || !state.holding) return state;
  const s: StackState = { ...state, holding: false };
  if (s.cur < STACK.minRing) {
    s.note = 'Too small';
    s.cur = 0;
    return s;
  }
  const gap = ceiling(s) - s.cur - STACK.thick;
  const points = gap <= 3 ? 3 : gap <= 10 ? 2 : 1;
  s.perfect = points === 3;
  s.score += points;
  s.note = points === 3 ? 'Perfect fit +3' : points === 2 ? 'Close +2' : '';
  s.rings = [...s.rings, s.cur];
  s.cur = 0;
  if (ceiling(s) < STACK.minRoom) {
    s.level += 1;
    s.rings = [];
    s.note = `Stack complete! Level ${s.level}`;
  }
  return s;
}
