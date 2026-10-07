export const ARCADE_GAMES = [
  {
    id: 'pulse',
    name: 'Pulse',
    color: '#B48CFF',
    tag: 'RHYTHM',
    description: 'Two rings. One perfect moment.',
    instruction: 'Tap when the shrinking ring meets the dotted ring.',
    unit: 'rings',
  },
  {
    id: 'switch',
    name: 'Orbit Switch',
    color: '#5AC8FA',
    tag: 'REFLEX',
    description: 'Change lanes. Stay in orbit.',
    instruction: 'Tap to switch lanes. Keep your dot away from incoming dots.',
    unit: 'dodges',
  },
  {
    id: 'lock',
    name: 'Dot Lock',
    color: '#FF8A4C',
    tag: 'PRECISION',
    description: 'Find the target. Lock it in.',
    instruction: 'Tap when your dot overlaps the outlined target.',
    unit: 'locks',
  },
] as const;
export type ArcadeId = (typeof ARCADE_GAMES)[number]['id'];
export type ArcadePhase = 'ready' | 'running' | 'paused' | 'over';
export interface ArcadeState {
  phase: ArcadePhase;
  score: number;
  elapsed: number;
  lane: number;
  obstacleLane: number;
  angle: number;
  target: number;
  radius: number;
  perfect: boolean;
}
export const TAU = Math.PI * 2;
export function angleDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function createArcade(): ArcadeState {
  return {
    phase: 'ready',
    score: 0,
    elapsed: 0,
    lane: 0,
    obstacleLane: 0,
    angle: -Math.PI / 2,
    target: 0.65,
    radius: 138,
    perfect: false,
  };
}
export function roundDuration(score: number) {
  return Math.max(0.9, 2.2 - score * 0.045);
}
export function stepArcade(state: ArcadeState, id: ArcadeId, dt: number): ArcadeState {
  if (state.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return state;
  const s = { ...state, elapsed: state.elapsed + dt };
  if (id === 'pulse') {
    s.radius = 138 - s.elapsed * (38 + Math.min(s.score, 40) * 1.6);
    if (s.radius < 64) s.phase = 'over';
  } else if (id === 'lock') {
    s.angle = -Math.PI / 2 + s.elapsed * (1.5 + Math.min(s.score, 40) * 0.07);
    if (s.angle > s.target + 0.22) s.phase = 'over';
  } else {
    const duration = roundDuration(s.score);
    s.angle = Math.PI / 2 + Math.PI * Math.min(s.elapsed / duration, 1);
    // Collision has width: switching after the dots meet is too late.
    const collisionAngle = 2 * Math.asin(21 / (2 * (s.obstacleLane === 0 ? 80 : 120)));
    if (s.elapsed >= duration * (1 - collisionAngle / Math.PI) && s.lane === s.obstacleLane) s.phase = 'over';
    else if (s.elapsed >= duration) {
      s.score += 1;
      s.elapsed = 0;
      s.angle = Math.PI / 2;
      s.obstacleLane = (s.score + Math.floor(s.score / 3)) % 2;
    }
  }
  return s;
}
export function tapArcade(state: ArcadeState, id: ArcadeId): ArcadeState {
  if (state.phase === 'over') return state;
  if (state.phase !== 'running')
    return {
      ...state,
      phase: 'running',
      angle: id === 'switch' && state.phase === 'ready' ? Math.PI / 2 : state.angle,
    };
  if (id === 'switch') return { ...state, lane: 1 - state.lane };
  const error = id === 'pulse' ? Math.abs(state.radius - 76) : angleDistance(state.angle, state.target);
  const tolerance = id === 'pulse' ? 12 : 0.22;
  if (error > tolerance + 1e-9) return { ...state, phase: 'over', perfect: false };
  return {
    ...state,
    score: state.score + 1,
    elapsed: 0,
    radius: 138,
    angle: -Math.PI / 2,
    target: 0.1 + (((state.score + 1) * 1.73) % 3.9),
    perfect: error < tolerance / 3,
  };
}
