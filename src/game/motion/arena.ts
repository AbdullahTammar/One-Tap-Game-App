import { base, clamp, dist, rand, validDt, type MotionBase, type MotionInput } from './common';

/**
 * Dot Arena: an agar-style survival arena with abilities, power-ups and a shrinking zone.
 * Every orb, human or bot, is driven by the same `ArenaCommand`, so bots can later be swapped for remote players
 * and the simulation can run on a server unchanged.
 */
export interface ArenaCommand {
  /** Desired heading, unit-ish vector; zero means coast. */
  dx: number;
  dy: number;
  dash: boolean;
}
export type PowerKind = 'shield' | 'magnet' | 'surge';
export interface Orb {
  id: number;
  name: string;
  color: string;
  /** Character skin, if any. Bots wear random fun skins so the arena looks alive. */
  emoji?: string;
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  dashCd: number;
  dashT: number;
  shield: number;
  magnet: number;
  alive: boolean;
  /** Bot brain: current heading and time until it reconsiders. */
  think: number;
  hx: number;
  hy: number;
}
export interface Pellet {
  x: number;
  y: number;
  color: number;
}
export interface Power {
  x: number;
  y: number;
  kind: PowerKind;
}
export interface ArenaState extends MotionBase {
  orbs: Orb[];
  pellets: Pellet[];
  powers: Power[];
  elapsed: number;
  zone: number;
  cmd: ArenaCommand;
  /** Pointer anchor for the floating joystick. */
  stick: { x: number; y: number } | null;
  peak: number;
  kills: number;
  rank: number;
  nextId: number;
}
export const ARENA = {
  world: 1400,
  pellets: 260,
  bots: 11,
  startMass: 20,
  matchTime: 180,
  dashCost: 0.12,
  dashCd: 2.5,
  powerEvery: 9,
};
export const PELLET_COLORS = ['#C8F560', '#5AC8FA', '#FF8A4C', '#B48CFF', '#FF5E7E', '#FFC94D'];
const BOT_NAMES = [
  'Nova',
  'Pixel',
  'Zed',
  'Mochi',
  'Blitz',
  'Echo',
  'Kiwi',
  'Orbit',
  'Luna',
  'Rex',
  'Vex',
  'Juno',
  'Sumo',
];
const BOT_EMOJI = ['👾', '🐸', '😎', '👻', '🤖', '🐱', '🍩', '⚽', '🦊', '👽', '🍕', '🐼', '🔥'];
const BOT_COLORS = ['#FF5E7E', '#5AC8FA', '#FF8A4C', '#B48CFF', '#FFC94D', '#4CE0B3', '#FF7AD9'];

export const radiusOf = (mass: number) => 4 * Math.sqrt(mass);
export const speedOf = (mass: number) => 260 / Math.pow(mass, 0.3);
/** An orb can eat another only when clearly bigger and mostly covering it. */
export function canEat(a: Orb, b: Orb) {
  return (
    a.mass > b.mass * 1.15 && b.shield <= 0 && dist(a.x, a.y, b.x, b.y) < radiusOf(a.mass) - radiusOf(b.mass) * 0.4
  );
}
export function zoneRadius(elapsed: number) {
  const full = ARENA.world * 0.72;
  const start = 45;
  if (elapsed < start) return full;
  return Math.max(170, full - (elapsed - start) * 3.6);
}
function spot(s: ArenaState, margin = 40) {
  return { x: margin + rand(s) * (ARENA.world - margin * 2), y: margin + rand(s) * (ARENA.world - margin * 2) };
}
function insideZone(s: ArenaState, x: number, y: number) {
  return dist(x, y, ARENA.world / 2, ARENA.world / 2) < s.zone;
}
function zoneSpot(s: ArenaState) {
  for (let i = 0; i < 10; i++) {
    const p = spot(s);
    if (insideZone(s, p.x, p.y)) return p;
  }
  return { x: ARENA.world / 2, y: ARENA.world / 2 };
}
function makeOrb(s: ArenaState, name: string, color: string, mass: number): Orb {
  const p = zoneSpot(s);
  const id = s.nextId++;
  return {
    id,
    name,
    color,
    // About half the bots wear a fun skin; the player's look comes from the equipped skin.
    emoji: id > 0 && rand(s) < 0.5 ? BOT_EMOJI[id % BOT_EMOJI.length] : undefined,
    ...p,
    mass,
    vx: 0,
    vy: 0,
    dashCd: 0,
    dashT: 0,
    shield: 2.5,
    magnet: 0,
    alive: true,
    think: 0,
    hx: 0,
    hy: 0,
  };
}
function addPellet(s: ArenaState) {
  const p = zoneSpot(s);
  s.pellets.push({ ...p, color: Math.floor(rand(s) * PELLET_COLORS.length) });
}
export function createArena(seed: number, playerName = 'You'): ArenaState {
  const s: ArenaState = {
    ...base(seed),
    orbs: [],
    pellets: [],
    powers: [],
    elapsed: 0,
    zone: zoneRadius(0),
    cmd: { dx: 0, dy: 0, dash: false },
    stick: null,
    peak: ARENA.startMass,
    kills: 0,
    rank: 1,
    nextId: 0,
  };
  s.orbs.push(makeOrb(s, playerName, '#FFFFFF', ARENA.startMass));
  s.orbs[0].x = ARENA.world / 2;
  s.orbs[0].y = ARENA.world / 2;
  for (let i = 0; i < ARENA.bots; i++)
    s.orbs.push(makeOrb(s, BOT_NAMES[i % BOT_NAMES.length], BOT_COLORS[i % BOT_COLORS.length], 12 + rand(s) * 40));
  for (let i = 0; i < ARENA.pellets; i++) addPellet(s);
  return s;
}
export const player = (s: ArenaState) => s.orbs[0];

/** Simple utility AI: flee the biggest threat, chase prey, otherwise graze toward pellets and the zone centre. */
export function botCommand(s: ArenaState, me: Orb): ArenaCommand {
  const r = radiusOf(me.mass);
  let threat: Orb | null = null;
  let prey: Orb | null = null;
  let threatD = Infinity;
  let preyD = Infinity;
  for (const o of s.orbs) {
    if (o === me || !o.alive) continue;
    const d = dist(me.x, me.y, o.x, o.y);
    if (o.mass > me.mass * 1.15 && d < 160 + radiusOf(o.mass) && d < threatD) [threat, threatD] = [o, d];
    else if (me.mass > o.mass * 1.25 && o.shield <= 0 && d < 220 + r && d < preyD) [prey, preyD] = [o, d];
  }
  const cx = ARENA.world / 2 - me.x;
  const cy = ARENA.world / 2 - me.y;
  const out = Math.hypot(cx, cy) > s.zone - r - 40;
  if (threat) {
    const dx = me.x - threat.x;
    const dy = me.y - threat.y;
    const n = Math.hypot(dx, dy) || 1;
    // Fleeing into the storm is worse than most bites, so bias back toward the centre near the edge.
    const k = out ? 0.6 : 0;
    return {
      dx: dx / n + (cx / (Math.hypot(cx, cy) || 1)) * k,
      dy: dy / n + (cy / (Math.hypot(cx, cy) || 1)) * k,
      dash: threatD < radiusOf(threat.mass) + r + 30 && me.mass > 30,
    };
  }
  if (out) return { dx: cx, dy: cy, dash: false };
  if (prey) {
    const dx = prey.x - me.x;
    const dy = prey.y - me.y;
    return { dx, dy, dash: preyD < r + 70 && me.mass > prey.mass * 1.6 };
  }
  return { dx: me.hx, dy: me.hy, dash: false };
}
function retarget(s: ArenaState, me: Orb) {
  let best: Pellet | null = null;
  let bd = Infinity;
  for (let i = 0; i < 12; i++) {
    const p = s.pellets[Math.floor(rand(s) * s.pellets.length)];
    if (!p) break;
    const d = dist(me.x, me.y, p.x, p.y);
    if (d < bd) [best, bd] = [p, d];
  }
  me.hx = best ? best.x - me.x : rand(s) - 0.5;
  me.hy = best ? best.y - me.y : rand(s) - 0.5;
  me.think = 0.6 + rand(s) * 0.8;
}
function move(o: Orb, c: ArenaCommand, dt: number) {
  const n = Math.hypot(c.dx, c.dy);
  if (c.dash && o.dashCd <= 0 && o.mass > ARENA.startMass) {
    o.mass *= 1 - ARENA.dashCost;
    o.dashCd = ARENA.dashCd;
    o.dashT = 0.28;
  }
  const sp = speedOf(o.mass) * (o.dashT > 0 ? 2.8 : 1) * Math.min(n, 1);
  const tx = n ? (c.dx / n) * sp : 0;
  const ty = n ? (c.dy / n) * sp : 0;
  const k = 1 - Math.exp(-8 * dt);
  o.vx += (tx - o.vx) * k;
  o.vy += (ty - o.vy) * k;
  const r = radiusOf(o.mass);
  o.x = clamp(o.x + o.vx * dt, r * 0.5, ARENA.world - r * 0.5);
  o.y = clamp(o.y + o.vy * dt, r * 0.5, ARENA.world - r * 0.5);
  o.dashCd = Math.max(0, o.dashCd - dt);
  o.dashT = Math.max(0, o.dashT - dt);
  o.shield = Math.max(0, o.shield - dt);
  o.magnet = Math.max(0, o.magnet - dt);
}
export function stepArena(state: ArenaState, rawDt: number): ArenaState {
  const dt = validDt(rawDt);
  if (state.phase !== 'running' || !dt) return state;
  const s: ArenaState = {
    ...state,
    elapsed: state.elapsed + dt,
    perfect: false,
    orbs: state.orbs.map((o) => ({ ...o })),
    pellets: state.pellets.slice(),
    powers: state.powers.slice(),
    cmd: { ...state.cmd, dash: false },
  };
  s.zone = zoneRadius(s.elapsed);
  for (const o of s.orbs) {
    if (!o.alive) continue;
    if (o.id === 0) move(o, state.cmd, dt);
    else {
      o.think -= dt;
      if (o.think <= 0) retarget(s, o);
      move(o, botCommand(s, o), dt);
    }
    // The storm burns mass outside the zone.
    if (!insideZone(s, o.x, o.y)) o.mass = Math.max(5, o.mass - o.mass * 0.09 * dt - 2 * dt);
    else o.mass = Math.max(ARENA.startMass * 0.5, o.mass - o.mass * 0.004 * dt);
  }
  // Pellets and power-ups.
  const kept: Pellet[] = [];
  for (const pellet of s.pellets) {
    let p = pellet;
    let eaten = false;
    for (const o of s.orbs) {
      if (!o.alive) continue;
      const r = radiusOf(o.mass);
      const d = dist(o.x, o.y, p.x, p.y);
      if (o.magnet > 0 && d < r + 110 && d > 1)
        p = { ...p, x: p.x + ((o.x - p.x) / d) * 260 * dt, y: p.y + ((o.y - p.y) / d) * 260 * dt };
      if (d < r) {
        o.mass += 1;
        eaten = true;
        break;
      }
    }
    if (!eaten) kept.push(p);
  }
  s.pellets = kept;
  while (s.pellets.length < ARENA.pellets) addPellet(s);
  if (Math.floor(s.elapsed / ARENA.powerEvery) > Math.floor(state.elapsed / ARENA.powerEvery) && s.powers.length < 4) {
    const kinds: PowerKind[] = ['shield', 'magnet', 'surge'];
    s.powers.push({ ...zoneSpot(s), kind: kinds[Math.floor(rand(s) * 3)] });
  }
  s.powers = s.powers.filter((pw) => {
    const o = s.orbs.find((q) => q.alive && dist(q.x, q.y, pw.x, pw.y) < radiusOf(q.mass) + 8);
    if (!o) return true;
    if (pw.kind === 'shield') o.shield = 5;
    else if (pw.kind === 'magnet') o.magnet = 7;
    else o.mass *= 1.25;
    if (o.id === 0) s.note = pw.kind === 'shield' ? 'Shield up!' : pw.kind === 'magnet' ? 'Magnet!' : 'Surge +25%';
    return false;
  });
  // Orbs eating orbs, biggest first.
  const order = s.orbs.filter((o) => o.alive).sort((a, b) => b.mass - a.mass);
  for (const a of order) {
    if (!a.alive) continue;
    for (const b of order) {
      if (a === b || !b.alive || !canEat(a, b)) continue;
      a.mass += b.mass * 0.85;
      b.alive = false;
      if (a.id === 0) {
        s.kills += 1;
        s.perfect = true;
        s.note = `Ate ${b.name}!`;
      }
    }
  }
  const me = s.orbs[0];
  // Fresh bots keep the arena busy until the zone gets tight.
  s.orbs = s.orbs.filter((o) => o.alive || o.id === 0);
  const wanted = s.zone > 400 ? ARENA.bots : Math.max(4, Math.round((ARENA.bots * s.zone) / 400));
  if (s.orbs.length - 1 < wanted && rand(s) < dt * 0.8) {
    const i = s.nextId;
    s.orbs.push(
      makeOrb(
        s,
        BOT_NAMES[i % BOT_NAMES.length],
        BOT_COLORS[i % BOT_COLORS.length],
        12 + rand(s) * Math.min(20 + s.elapsed / 2, 90),
      ),
    );
  }
  s.peak = Math.max(s.peak, me.mass);
  s.score = Math.floor(s.peak);
  s.rank = 1 + s.orbs.filter((o) => o.id !== 0 && o.mass > me.mass).length;
  if (!me.alive) {
    s.phase = 'over';
    s.note = 'You were eaten!';
  } else if (s.elapsed >= ARENA.matchTime) {
    s.phase = 'over';
    s.note = s.rank === 1 ? 'Champion of the arena!' : `Finished #${s.rank}`;
    // Winning the match is worth a bonus on top of peak mass.
    s.score += Math.max(0, 6 - s.rank) * 25;
  }
  return s;
}
export function leaderboard(s: ArenaState, n = 5) {
  return s.orbs
    .filter((o) => o.alive)
    .sort((a, b) => b.mass - a.mass)
    .slice(0, n);
}
export function inputArena(state: ArenaState, ev: MotionInput): ArenaState {
  if (state.phase !== 'running' || ev.type === 'tilt' || ev.type === 'touches') return state;
  if (ev.type === 'action') return { ...state, cmd: { ...state.cmd, dash: true } };
  if (ev.type === 'up') return { ...state, stick: null, cmd: { dx: 0, dy: 0, dash: state.cmd.dash } };
  // Floating joystick: direction from where the finger first landed, full speed at 40 units.
  const stick = ev.type === 'down' || !state.stick ? { x: ev.x, y: ev.y } : state.stick;
  const dx = ev.x - stick.x;
  const dy = ev.y - stick.y;
  const n = Math.hypot(dx, dy);
  const k = n < 4 ? 0 : Math.min(n / 40, 1) / n;
  return { ...state, stick, cmd: { dx: dx * k, dy: dy * k, dash: state.cmd.dash } };
}
