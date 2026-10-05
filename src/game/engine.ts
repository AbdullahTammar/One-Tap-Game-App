/**
 * Lumo game engine.
 *
 * Pure, deterministic and allocation-light. Every function is a worklet so the
 * whole simulation (frame step + tap resolution) runs on the UI thread with
 * zero bridge latency, and the same code is unit-tested under Jest, where the
 * 'worklet' directive is just an inert string.
 */
import { GAME } from './constants';

export type Phase = 'ready' | 'running' | 'paused' | 'over';
export type Direction = 1 | -1;
export type MissReason = 'early' | 'late' | 'slip';

export interface GameState {
  phase: Phase;
  /** Orb position on the ring. */
  angle: number;
  /** Gate centre on the ring. */
  gate: number;
  dir: Direction;
  speed: number;
  baseSpeed: number;
  score: number;
  perfects: number;
  /** Consecutive perfect hits. */
  combo: number;
  bestCombo: number;
  topSpeed: number;
  /** Orb has entered the current gate window. */
  inside: boolean;
  continues: number;
  /** PRNG state (mulberry32). */
  seed: number;
  /** Seconds spent running. */
  elapsed: number;
}

export type GameEvent =
  | { type: 'start' }
  | { type: 'resume' }
  | { type: 'hit'; perfect: boolean; score: number; combo: number }
  | { type: 'miss'; reason: MissReason; score: number };

export interface Transition {
  state: GameState;
  event: GameEvent | null;
}

export function wrapAngle(a: number): number {
  'worklet';
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function gateHalf(score: number): number {
  'worklet';
  return Math.max(GAME.gateHalfMin, GAME.gateHalfStart - score * GAME.gateHalfShrink);
}

export function levelFor(score: number): number {
  'worklet';
  return 1 + Math.floor(score / GAME.gatesPerLevel);
}

/** mulberry32 — returns [value in [0,1), nextSeed]. */
export function nextRandom(seed: number): [number, number] {
  'worklet';
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export function createGame(baseSpeed: number = GAME.startSpeed, seed: number = 1): GameState {
  'worklet';
  const start = -Math.PI / 2;
  return {
    phase: 'ready',
    angle: start,
    gate: start + 1.8,
    dir: 1,
    speed: baseSpeed,
    baseSpeed,
    score: 0,
    perfects: 0,
    combo: 0,
    bestCombo: 0,
    topSpeed: baseSpeed,
    inside: false,
    continues: 0,
    seed: seed | 0,
    elapsed: 0,
  };
}

function placeGate(s: GameState, from: number, dir: Direction): { gate: number; seed: number } {
  'worklet';
  const [r, seed] = nextRandom(s.seed);
  return { gate: wrapAngle(from + dir * (GAME.nextGateMin + r * GAME.nextGateRange)), seed };
}

/** Advance the simulation by `dt` seconds. */
export function step(s: GameState, dt: number): Transition {
  'worklet';
  if (s.phase !== 'running' || !(dt > 0)) return { state: s, event: null };
  const frame = Math.min(dt, GAME.maxFrameDelta);
  const n = Math.max(1, Math.ceil(frame / GAME.maxStep));
  const h = frame / n;
  const half = gateHalf(s.score);
  let angle = s.angle;
  let inside = s.inside;
  for (let i = 0; i < n; i++) {
    angle += s.dir * s.speed * h;
    const d = wrapAngle(angle - s.gate) * s.dir;
    if (Math.abs(d) <= half) inside = true;
    if (inside && d > half + GAME.slipTolerance) {
      return {
        state: { ...s, angle: wrapAngle(angle), inside, phase: 'over', combo: 0, elapsed: s.elapsed + h * (i + 1) },
        event: { type: 'miss', reason: 'slip', score: s.score },
      };
    }
  }
  return { state: { ...s, angle: wrapAngle(angle), inside, elapsed: s.elapsed + frame }, event: null };
}

/** Resolve a player tap. */
export function tap(s: GameState): Transition {
  'worklet';
  if (s.phase === 'over') return { state: s, event: null };
  if (s.phase === 'ready' || s.phase === 'paused') {
    const resumed = s.phase === 'paused' || s.score > 0;
    return { state: { ...s, phase: 'running' }, event: { type: resumed ? 'resume' : 'start' } };
  }
  const signed = wrapAngle(s.angle - s.gate) * s.dir;
  const dist = Math.abs(signed);
  const half = gateHalf(s.score);
  if (dist <= half + GAME.tapTolerance) {
    const perfect = dist <= half * GAME.perfectFraction;
    const dir: Direction = s.dir === 1 ? -1 : 1;
    const { gate, seed } = placeGate(s, s.angle, dir);
    const speed = Math.min(s.speed * GAME.speedGrowth, GAME.maxSpeed);
    const combo = perfect ? s.combo + 1 : 0;
    const score = s.score + 1;
    return {
      state: {
        ...s,
        score,
        dir,
        gate,
        seed,
        speed,
        topSpeed: Math.max(s.topSpeed, speed),
        inside: false,
        perfects: s.perfects + (perfect ? 1 : 0),
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
      },
      event: { type: 'hit', perfect, score, combo },
    };
  }
  return {
    state: { ...s, phase: 'over', combo: 0 },
    event: { type: 'miss', reason: signed < 0 ? 'early' : 'late', score: s.score },
  };
}

export function pause(s: GameState): GameState {
  'worklet';
  return s.phase === 'running' ? { ...s, phase: 'paused' } : s;
}

export function canContinue(s: GameState): boolean {
  'worklet';
  return s.phase === 'over' && s.continues < GAME.maxContinues;
}

/** Second chance after a rewarded ad: keep the score, ease speed, fresh gate ahead. */
export function continueRun(s: GameState): GameState {
  'worklet';
  if (!canContinue(s)) return s;
  const { gate, seed } = placeGate(s, s.angle, s.dir);
  return {
    ...s,
    phase: 'ready',
    gate,
    seed,
    inside: false,
    speed: Math.max(s.baseSpeed, s.speed * 0.9),
    continues: s.continues + 1,
  };
}

/** Ring point for an angle in the 300-unit design space. */
export function ringPoint(angle: number, cx: number, cy: number, r: number): { x: number; y: number } {
  'worklet';
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}
