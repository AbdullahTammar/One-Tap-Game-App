import { base, rand, validDt, type MotionBase, type MotionInput } from './common';
import { swipeDir, type Dir } from './swipe';

/**
 * Dot Paint: a territory battle. Leave your land to draw a trail, come home to claim everything it encloses.
 * Cut a rival's trail to knock them out; if anyone crosses yours, you are out.
 * The world advances in fixed ticks and every painter (human or bot) is driven by a direction,
 * which is exactly what an online server would receive from each player.
 */
export const PAINT = { size: 32, cell: 10, tick: 1 / 8, time: 90, bots: 4, respawn: 2, win: 60 };
const N = PAINT.size;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
export const PAINT_COLORS = ['#FFFFFF', '#FF5E7E', '#5AC8FA', '#FFC94D', '#B48CFF', '#4CE0B3'];
const BOT_NAMES = ['Pixel', 'Mochi', 'Blitz', 'Juno', 'Kiwi'];
const BOT_EMOJI = ['🐸', '👾', '🦊', '🍩', '🤖'];

export interface Painter {
  id: number;
  name: string;
  emoji?: string;
  x: number;
  y: number;
  dir: Dir;
  next: Dir;
  alive: boolean;
  trail: number;
  respawn: number;
  /** Bot loop plan: steps left on this leg and turns made since leaving home. */
  leg: number;
  turns: number;
  turnWay: 1 | 3;
  kills: number;
}
export interface PaintState extends MotionBase {
  owner: number[];
  trail: number[];
  painters: Painter[];
  acc: number;
  timeLeft: number;
  anchor: { x: number; y: number } | null;
  pct: number;
  rank: number;
}
const idx = (x: number, y: number) => y * N + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

function base3(s: PaintState, p: Painter) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (inside(p.x + dx, p.y + dy)) s.owner[idx(p.x + dx, p.y + dy)] = p.id;
}
function freeSpot(s: PaintState) {
  for (let i = 0; i < 40; i++) {
    const x = 2 + Math.floor(rand(s) * (N - 4));
    const y = 2 + Math.floor(rand(s) * (N - 4));
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++)
      for (let dx = -2; dx <= 2 && ok; dx++) ok = s.owner[idx(x + dx, y + dy)] < 0 && s.trail[idx(x + dx, y + dy)] < 0;
    if (ok) return { x, y };
  }
  return { x: 2 + Math.floor(rand(s) * (N - 4)), y: 2 + Math.floor(rand(s) * (N - 4)) };
}
function spawn(s: PaintState, p: Painter) {
  const at = freeSpot(s);
  p.x = at.x;
  p.y = at.y;
  p.alive = true;
  p.trail = 0;
  p.dir = Math.floor(rand(s) * 4) as Dir;
  p.next = p.dir;
  p.leg = 0;
  p.turns = 0;
  base3(s, p);
}
export function createPaint(seed: number, playerName = 'You'): PaintState {
  const s: PaintState = {
    ...base(seed),
    owner: new Array(N * N).fill(-1),
    trail: new Array(N * N).fill(-1),
    painters: [],
    acc: 0,
    timeLeft: PAINT.time,
    anchor: null,
    pct: 0,
    rank: 1,
  };
  for (let id = 0; id <= PAINT.bots; id++) {
    const p: Painter = {
      id,
      name: id === 0 ? playerName : BOT_NAMES[id - 1],
      emoji: id === 0 ? undefined : BOT_EMOJI[id - 1],
      x: 0,
      y: 0,
      dir: 0,
      next: 0,
      alive: true,
      trail: 0,
      respawn: 0,
      leg: 0,
      turns: 0,
      turnWay: rand(s) < 0.5 ? 1 : 3,
      kills: 0,
    };
    s.painters.push(p);
    if (id === 0) {
      p.x = N / 2;
      p.y = N / 2;
      p.dir = 0;
      p.next = 0;
      base3(s, p);
    } else spawn(s, p);
  }
  updateStats(s);
  return s;
}
/** Turns a closed trail into land, plus everything it encloses. */
export function capture(s: PaintState, id: number) {
  for (let i = 0; i < N * N; i++)
    if (s.trail[i] === id) {
      s.owner[i] = id;
      s.trail[i] = -1;
    }
  const seen = new Uint8Array(N * N);
  const stack: number[] = [];
  for (let i = 0; i < N; i++) for (const c of [idx(i, 0), idx(i, N - 1), idx(0, i), idx(N - 1, i)]) stack.push(c);
  while (stack.length) {
    const c = stack.pop()!;
    if (seen[c] || s.owner[c] === id) continue;
    seen[c] = 1;
    const x = c % N;
    const y = Math.floor(c / N);
    for (let d = 0; d < 4; d++) if (inside(x + DX[d], y + DY[d])) stack.push(idx(x + DX[d], y + DY[d]));
  }
  for (let i = 0; i < N * N; i++)
    if (!seen[i] && s.owner[i] !== id) {
      s.owner[i] = id;
      if (s.trail[i] >= 0) s.trail[i] = -1;
    }
}
function kill(s: PaintState, victim: Painter) {
  victim.alive = false;
  victim.respawn = PAINT.respawn;
  for (let i = 0; i < N * N; i++) {
    if (s.trail[i] === victim.id) s.trail[i] = -1;
    if (s.owner[i] === victim.id) s.owner[i] = -1;
  }
}
function safe(s: PaintState, p: Painter, d: number) {
  const x = p.x + DX[d];
  const y = p.y + DY[d];
  return inside(x, y) && s.trail[idx(x, y)] !== p.id;
}
function botThink(s: PaintState, p: Painter) {
  const home = s.owner[idx(p.x, p.y)] === p.id;
  let want: number = p.dir;
  if (home) {
    p.turns = 0;
    p.leg = 3 + Math.floor(rand(s) * 5);
    if (rand(s) < 0.2) want = (p.dir + (rand(s) < 0.5 ? 1 : 3)) % 4;
  } else {
    p.leg -= 1;
    if (p.trail > 22) {
      // Too greedy: head straight back to the nearest owned cell.
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < N * N; i++)
        if (s.owner[i] === p.id) {
          const d = Math.abs((i % N) - p.x) + Math.abs(Math.floor(i / N) - p.y);
          if (d < bd) [best, bd] = [i, d];
        }
      if (best >= 0) {
        const tx = best % N;
        const ty = Math.floor(best / N);
        want = Math.abs(tx - p.x) > Math.abs(ty - p.y) ? (tx > p.x ? 1 : 3) : ty > p.y ? 2 : 0;
      }
    } else if (p.leg <= 0 && p.turns < 3) {
      want = (p.dir + p.turnWay) % 4;
      p.turns += 1;
      p.leg = 3 + Math.floor(rand(s) * 5);
    }
  }
  if (want === (p.dir + 2) % 4) want = p.dir;
  if (!safe(s, p, want)) {
    const options = [p.dir, (p.dir + 1) % 4, (p.dir + 3) % 4].filter((d) => safe(s, p, d));
    if (options.length) want = options[Math.floor(rand(s) * options.length)];
  }
  p.next = want as Dir;
}
function tick(s: PaintState) {
  for (const p of s.painters) {
    if (!p.alive) {
      p.respawn -= PAINT.tick;
      if (p.id !== 0 && p.respawn <= 0) spawn(s, p);
      continue;
    }
    if (p.id !== 0) botThink(s, p);
    if (p.next !== (p.dir + 2) % 4) p.dir = p.next;
    p.x += DX[p.dir];
    p.y += DY[p.dir];
    if (!inside(p.x, p.y)) {
      p.x = Math.max(0, Math.min(N - 1, p.x));
      kill(s, p);
      continue;
    }
    const c = idx(p.x, p.y);
    const cut = s.trail[c];
    if (cut >= 0) {
      const victim = s.painters[cut];
      if (victim.id !== p.id) p.kills += 1;
      kill(s, victim);
      if (victim.id === p.id) continue;
      if (p.id === 0) {
        s.note = `You cut ${victim.name}!`;
        s.perfect = true;
      }
    }
    if (s.owner[c] === p.id) {
      if (p.trail > 0) capture(s, p.id);
      p.trail = 0;
    } else {
      s.trail[c] = p.id;
      p.trail += 1;
    }
    // Head-to-head: two heads on the same cell knock the shorter trail out.
    for (const q of s.painters)
      if (q !== p && q.alive && q.x === p.x && q.y === p.y) kill(s, q.trail >= p.trail ? q : p);
  }
}
function updateStats(s: PaintState) {
  const counts = new Array(s.painters.length).fill(0);
  for (const o of s.owner) if (o >= 0) counts[o] += 1;
  s.pct = Math.round((counts[0] / (N * N)) * 1000) / 10;
  s.score = Math.max(s.score, Math.floor(s.pct));
  s.rank = 1 + counts.filter((c, i) => i > 0 && c > counts[0]).length;
}
export function paintBoard(s: PaintState) {
  const counts = new Array(s.painters.length).fill(0);
  for (const o of s.owner) if (o >= 0) counts[o] += 1;
  return s.painters.map((p) => ({ p, pct: Math.round((counts[p.id] / (N * N)) * 100) })).sort((a, b) => b.pct - a.pct);
}
export function stepPaint(state: PaintState, rawDt: number): PaintState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: PaintState = {
    ...state,
    perfect: false,
    acc: state.acc + dt,
    timeLeft: state.timeLeft - dt,
    owner: state.owner.slice(),
    trail: state.trail.slice(),
    painters: state.painters.map((p) => ({ ...p })),
  };
  while (s.acc >= PAINT.tick && s.phase === 'running') {
    s.acc -= PAINT.tick;
    tick(s);
    if (!s.painters[0].alive) {
      s.phase = 'over';
      s.note = 'Your trail was cut!';
    }
  }
  updateStats(s);
  if (s.phase === 'running' && (s.timeLeft <= 0 || s.pct >= PAINT.win)) {
    s.phase = 'over';
    s.note = s.pct >= PAINT.win ? 'Total domination!' : s.rank === 1 ? 'You painted the most!' : `Finished #${s.rank}`;
  }
  return s;
}
export function inputPaint(state: PaintState, ev: MotionInput): PaintState {
  if (state.phase !== 'running' || ev.type === 'tilt' || ev.type === 'action' || ev.type === 'touches') return state;
  if (ev.type === 'down') return { ...state, anchor: { x: ev.x, y: ev.y } };
  if (!state.anchor) return state;
  // Steer as soon as the finger has moved far enough; no need to lift between turns.
  const dir = swipeDir(ev.x - state.anchor.x, ev.y - state.anchor.y);
  const anchor = ev.type === 'up' ? null : dir === null ? state.anchor : { x: ev.x, y: ev.y };
  if (dir === null) return { ...state, anchor };
  const me = state.painters[0];
  if (dir === (me.dir + 2) % 4) return { ...state, anchor };
  return { ...state, anchor, painters: [{ ...me, next: dir }, ...state.painters.slice(1)] };
}
