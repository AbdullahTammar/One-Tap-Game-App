import { base, rand, validDt, type MotionBase, type MotionInput } from './common';

export interface ChargeState extends MotionBase {
  mode: 'aim' | 'charging' | 'flying' | 'falling';
  charge: number;
  /** Distance to the next pad, in field units. */
  gap: number;
  padR: number;
  jump: number;
  t: number;
}
export const CHARGE = { fullTime: 1.1, overTime: 0.9, maxJump: 240, flyTime: 0.55, startX: 50, groundY: 230 };

function nextGap(s: ChargeState) {
  return 70 + rand(s) * 160;
}
export function padRadius(score: number) {
  return Math.max(10, 24 - score * 0.6);
}
export function createCharge(seed: number): ChargeState {
  const s: ChargeState = { ...base(seed), mode: 'aim', charge: 0, gap: 0, padR: padRadius(0), jump: 0, t: 0 };
  s.gap = nextGap(s);
  return s;
}
export function stepCharge(state: ChargeState, rawDt: number): ChargeState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s = { ...state };
  if (s.mode === 'charging') {
    s.charge += dt / CHARGE.fullTime;
    // Holding past full power burns out the jump.
    if (s.charge > 1 + CHARGE.overTime / CHARGE.fullTime) {
      s.mode = 'falling';
      s.jump = 0;
      s.t = 0;
      s.note = 'Overcharged!';
    }
  } else if (s.mode === 'flying' || s.mode === 'falling') {
    s.t += dt;
    if (s.t >= CHARGE.flyTime) {
      const error = Math.abs(s.jump - s.gap);
      if (s.mode === 'flying' && error <= s.padR) {
        s.perfect = error < s.padR / 3;
        s.score += s.perfect ? 2 : 1;
        s.note = s.perfect ? 'Perfect landing +2' : '';
        s.mode = 'aim';
        s.charge = 0;
        s.t = 0;
        s.padR = padRadius(s.score);
        s.gap = nextGap(s);
      } else {
        s.phase = 'over';
        if (!s.note) s.note = s.jump < s.gap ? 'Too short' : 'Too far';
      }
    }
  }
  return s;
}
export function chargePower(charge: number) {
  return Math.min(charge, 1);
}
export function inputCharge(state: ChargeState, ev: MotionInput): ChargeState {
  if (state.phase !== 'running') return state;
  if (ev.type === 'down' && state.mode === 'aim')
    return { ...state, mode: 'charging', charge: 0, note: '', perfect: false };
  if (ev.type === 'up' && state.mode === 'charging')
    return { ...state, mode: 'flying', jump: chargePower(state.charge) * CHARGE.maxJump, t: 0 };
  return state;
}
