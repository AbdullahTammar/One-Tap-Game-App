import { base, clamp, dist, FIELD, rand, validDt, type MotionBase, type MotionInput } from './common';

export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface DriftState extends MotionBase {
  x: number;
  y: number;
  grab: { x: number; y: number } | null;
  enemies: Mover[];
  gold: { x: number; y: number };
  combo: number;
  comboTimer: number;
  spawnTimer: number;
  elapsed: number;
}
export const DRIFT = { player: 9, enemy: 7, gold: 9, comboWindow: 3, maxEnemies: 16 };

function placeGold(s: DriftState) {
  for (let i = 0; i < 8; i++) {
    const g = { x: 30 + rand(s) * 260, y: 30 + rand(s) * 260 };
    if (dist(g.x, g.y, s.x, s.y) > 70) return g;
  }
  return { x: FIELD - s.x, y: FIELD - s.y };
}
export function createDrift(seed: number): DriftState {
  const s: DriftState = {
    ...base(seed),
    x: 160,
    y: 160,
    grab: null,
    enemies: [],
    gold: { x: 0, y: 0 },
    combo: 0,
    comboTimer: 0,
    spawnTimer: 0.6,
    elapsed: 0,
  };
  s.gold = placeGold(s);
  return s;
}
export function enemySpeed(elapsed: number) {
  return Math.min(70 + elapsed * 2.2, 170);
}
function spawnEnemy(s: DriftState) {
  const side = Math.floor(rand(s) * 4);
  const t = rand(s) * FIELD;
  const [x, y] = side === 0 ? [t, -8] : side === 1 ? [FIELD + 8, t] : side === 2 ? [t, FIELD + 8] : [-8, t];
  // Aim at the player with a little spread so standing still is never safe and never certain death.
  const a = Math.atan2(s.y - y, s.x - x) + (rand(s) - 0.5) * 0.5;
  const v = enemySpeed(s.elapsed) * (0.8 + rand(s) * 0.4);
  s.enemies.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
}
export function stepDrift(state: DriftState, rawDt: number): DriftState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: DriftState = { ...state, elapsed: state.elapsed + dt, perfect: false };
  s.enemies = state.enemies
    .map((e) => ({ ...e, x: e.x + e.vx * dt, y: e.y + e.vy * dt }))
    .filter((e) => e.x > -20 && e.x < FIELD + 20 && e.y > -20 && e.y < FIELD + 20);
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0 && s.enemies.length < DRIFT.maxEnemies) {
    spawnEnemy(s);
    s.spawnTimer = Math.max(0.28, 1.1 - s.elapsed * 0.012);
  }
  if (s.combo > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) {
      s.combo = 0;
      s.note = 'Combo lost';
    }
  }
  if (s.enemies.some((e) => dist(e.x, e.y, s.x, s.y) < DRIFT.player + DRIFT.enemy - 2)) s.phase = 'over';
  return s;
}
export function inputDrift(state: DriftState, ev: MotionInput): DriftState {
  if (state.phase !== 'running' || ev.type === 'tilt' || ev.type === 'action' || ev.type === 'touches') return state;
  if (ev.type === 'down') return { ...state, grab: { x: ev.x, y: ev.y } };
  if (ev.type === 'up') return { ...state, grab: null };
  if (!state.grab) return { ...state, grab: { x: ev.x, y: ev.y } };
  // Relative drag: the finger never has to cover the dot.
  const s: DriftState = {
    ...state,
    x: clamp(state.x + ev.x - state.grab.x, DRIFT.player, FIELD - DRIFT.player),
    y: clamp(state.y + ev.y - state.grab.y, DRIFT.player, FIELD - DRIFT.player),
    grab: { x: ev.x, y: ev.y },
  };
  if (dist(s.x, s.y, s.gold.x, s.gold.y) < DRIFT.player + DRIFT.gold) {
    s.combo = Math.min(s.combo + 1, 8);
    s.comboTimer = DRIFT.comboWindow;
    s.score += s.combo;
    s.perfect = s.combo >= 3;
    s.note = s.combo > 1 ? `Combo x${s.combo}` : '';
    s.gold = placeGold(s);
  }
  return s;
}
