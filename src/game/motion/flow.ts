import { base, rand, validDt, type MotionBase, type MotionInput } from './common';

export const FLOW = { size: 6, colors: 4, time: 45, cell: 320 / 6, hit: 21 };
export const FLOW_COLORS = ['#FF5E7E', '#5AC8FA', '#C8F560', '#B48CFF'] as const;
export interface FlowState extends MotionBase {
  grid: number[];
  path: number[];
  loop: boolean;
  timeLeft: number;
  burst: number[];
  burstColor: number;
  burstLeft: number;
}
export function cellCenter(i: number) {
  return { x: (i % FLOW.size) * FLOW.cell + FLOW.cell / 2, y: Math.floor(i / FLOW.size) * FLOW.cell + FLOW.cell / 2 };
}
function cellAt(x: number, y: number) {
  const c = Math.floor(x / FLOW.cell);
  const r = Math.floor(y / FLOW.cell);
  if (c < 0 || r < 0 || c >= FLOW.size || r >= FLOW.size) return -1;
  const i = r * FLOW.size + c;
  const p = cellCenter(i);
  // Only count a cell when the finger is near its dot, so diagonal slides don't snag neighbours.
  return Math.hypot(p.x - x, p.y - y) <= FLOW.hit ? i : -1;
}
const adjacent = (a: number, b: number) =>
  Math.abs((a % FLOW.size) - (b % FLOW.size)) + Math.abs(Math.floor(a / FLOW.size) - Math.floor(b / FLOW.size)) === 1;

export function createFlow(seed: number): FlowState {
  const s: FlowState = {
    ...base(seed),
    grid: [],
    path: [],
    loop: false,
    timeLeft: FLOW.time,
    burst: [],
    burstColor: 0,
    burstLeft: 0,
  };
  s.grid = Array.from({ length: FLOW.size * FLOW.size }, () => Math.floor(rand(s) * FLOW.colors));
  return s;
}
export function stepFlow(state: FlowState, rawDt: number): FlowState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const timeLeft = state.timeLeft - dt;
  const burstLeft = Math.max(0, state.burstLeft - dt);
  return timeLeft <= 0
    ? { ...state, timeLeft: 0, phase: 'over', path: [], burst: [], burstLeft: 0, note: "Time's up" }
    : { ...state, timeLeft, burstLeft, burst: burstLeft > 0 ? state.burst : [] };
}
/** Removes cleared cells, drops the dots above them, and refills from the top. */
export function collapse(s: FlowState, clear: Set<number>) {
  const g = s.grid.slice();
  for (let c = 0; c < FLOW.size; c++) {
    const kept: number[] = [];
    for (let r = FLOW.size - 1; r >= 0; r--) if (!clear.has(r * FLOW.size + c)) kept.push(g[r * FLOW.size + c]);
    for (let r = FLOW.size - 1, k = 0; r >= 0; r--, k++)
      g[r * FLOW.size + c] = k < kept.length ? kept[k] : Math.floor(rand(s) * FLOW.colors);
  }
  s.grid = g;
}
export function inputFlow(state: FlowState, ev: MotionInput): FlowState {
  if (state.phase !== 'running' || ev.type === 'tilt' || ev.type === 'action' || ev.type === 'touches') return state;
  if (ev.type === 'up') {
    if (state.path.length < 2) return { ...state, path: [], loop: false };
    const s: FlowState = { ...state, path: [], loop: false, perfect: state.loop };
    const color = state.grid[state.path[0]];
    const clear = new Set(state.loop ? state.grid.flatMap((c, i) => (c === color ? [i] : [])) : state.path);
    s.burst = Array.from(clear);
    s.burstColor = color;
    s.burstLeft = 0.4;
    s.score += clear.size;
    // Long chains buy time: the clock is the real opponent.
    const bonus = state.loop ? 3 : state.path.length >= 4 ? 1 : 0;
    s.timeLeft = Math.min(FLOW.time, s.timeLeft + bonus);
    s.note = state.loop ? `Loop! +${clear.size}` : bonus ? `+${bonus}s` : '';
    collapse(s, clear);
    return s;
  }
  const cell = cellAt(ev.x, ev.y);
  if (cell < 0) return state;
  if (ev.type === 'down' || state.path.length === 0) return { ...state, path: [cell], loop: false, note: '' };
  const path = state.path;
  const last = path[path.length - 1];
  if (cell === last || state.loop) return state;
  // Backtracking undoes the last link.
  if (path.length > 1 && cell === path[path.length - 2]) return { ...state, path: path.slice(0, -1) };
  if (!adjacent(cell, last) || state.grid[cell] !== state.grid[path[0]]) return state;
  if (path.includes(cell)) return { ...state, path: [...path, cell], loop: true };
  return { ...state, path: [...path, cell] };
}
