/** Shared plumbing for the touch-and-motion games. All game rules are pure and seeded so they can be replayed. */
export type MotionPhase = 'ready' | 'running' | 'paused' | 'over';
/** Field coordinates are always in the 0–320 viewBox space. */
export type MotionInput =
  { type: 'down' | 'move' | 'up'; x: number; y: number } | { type: 'tilt'; x: number; y: number } | { type: 'action' };
export interface MotionBase {
  phase: MotionPhase;
  score: number;
  seed: number;
  /** Short message for the HUD, e.g. "Combo x4". Empty when there is nothing to say. */
  note: string;
  perfect: boolean;
}
export const FIELD = 320;
export const TAU = Math.PI * 2;

/** mulberry32: tiny deterministic PRNG. Mutates `s.seed`, so call it on a copied state only. */
export function rand(s: { seed: number }) {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randomSeed() {
  return (Math.random() * 2 ** 31) | 0;
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function angleDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function base(seed: number): MotionBase {
  return { phase: 'ready', score: 0, seed, note: '', perfect: false };
}
export function validDt(dt: number) {
  return Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;
}
