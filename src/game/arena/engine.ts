import { acquire, createPool, release, type Pool } from '../core/memory';
import { emitEvent, EventKind, type EventBus } from '../core/events';
import type { InputState } from '../core/input';
import { ARENA } from '../motion/arena';

export const ORB_CAPACITY = 32;
export const ARENA_EVENT_BUDGET = 8;
export enum F {
  id,
  x,
  y,
  mass,
  vx,
  vy,
  dashCd,
  dashT,
  shield,
  magnet,
  alive,
  think,
  hx,
  hy,
  previousX,
  previousY,
  fields,
}
export interface ArenaBuffers {
  orbs: Float64Array;
  pool: Pool;
  order: Uint8Array;
  sorted: Uint8Array;
  top: Uint8Array;
  name: Uint8Array;
  color: Uint8Array;
  emoji: Int8Array;
  count: number;
  pelletX: Float64Array;
  pelletY: Float64Array;
  pelletColor: Uint8Array;
  pelletCount: number;
  powerX: Float64Array;
  powerY: Float64Array;
  powerKind: Uint8Array;
  powerCount: number;
  seed: number;
  elapsed: number;
  zone: number;
  peak: number;
  score: number;
  kills: number;
  rank: number;
  nextId: number;
  over: boolean;
  perfect: boolean;
  reason: number;
  noteKind: number;
  noteName: number;
  cmdX: number;
  cmdY: number;
  dashPending: boolean;
  stick: boolean;
  stickX: number;
  stickY: number;
  finger: number;
  spotX: number;
  spotY: number;
  brainX: number;
  brainY: number;
  brainDash: boolean;
  best: number;
  baseKills: number;
  achievementMask: number;
}
export function orb(s: ArenaBuffers, field: F, slot: number): number {
  'worklet';
  return s.orbs[field * ORB_CAPACITY + slot];
}
export function put(s: ArenaBuffers, field: F, slot: number, value: number) {
  'worklet';
  s.orbs[field * ORB_CAPACITY + slot] = value;
}
export function radius(mass: number) {
  'worklet';
  return 4 * Math.sqrt(mass);
}
export function arenaZone(elapsed: number) {
  'worklet';
  return elapsed < 45 ? ARENA.world * 0.72 : Math.max(170, ARENA.world * 0.72 - (elapsed - 45) * 3.6);
}
function distance(ax: number, ay: number, bx: number, by: number) {
  'worklet';
  return Math.hypot(ax - bx, ay - by);
}
function clamp(v: number, low: number, high: number) {
  'worklet';
  return Math.min(high, Math.max(low, v));
}
function random(s: ArenaBuffers) {
  'worklet';
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function inside(s: ArenaBuffers, x: number, y: number) {
  'worklet';
  return distance(x, y, ARENA.world / 2, ARENA.world / 2) < s.zone;
}
function zoneSpot(s: ArenaBuffers) {
  'worklet';
  for (let i = 0; i < 10; i++) {
    s.spotX = 40 + random(s) * (ARENA.world - 80);
    s.spotY = 40 + random(s) * (ARENA.world - 80);
    if (inside(s, s.spotX, s.spotY)) return;
  }
  s.spotX = ARENA.world / 2;
  s.spotY = ARENA.world / 2;
}
function spawn(s: ArenaBuffers, mass: number, name: number, color: number) {
  'worklet';
  const slot = acquire(s.pool);
  if (slot < 0) return;
  zoneSpot(s);
  const id = s.nextId++;
  for (let f = 0; f < F.fields; f++) put(s, f, slot, 0);
  put(s, F.id, slot, id);
  put(s, F.x, slot, s.spotX);
  put(s, F.y, slot, s.spotY);
  put(s, F.previousX, slot, s.spotX);
  put(s, F.previousY, slot, s.spotY);
  put(s, F.mass, slot, mass);
  put(s, F.alive, slot, 1);
  put(s, F.shield, slot, 2.5);
  s.name[slot] = name;
  s.color[slot] = color;
  s.emoji[slot] = id > 0 && random(s) < 0.5 ? id % 13 : -1;
  s.order[s.count++] = slot;
}
function pellet(s: ArenaBuffers) {
  'worklet';
  zoneSpot(s);
  const i = s.pelletCount++;
  s.pelletX[i] = s.spotX;
  s.pelletY[i] = s.spotY;
  s.pelletColor[i] = Math.floor(random(s) * 6);
}
export function resetArena(s: ArenaBuffers, seed = s.seed) {
  'worklet';
  s.pool.active.fill(0);
  s.pool.count = 0;
  for (let i = 0; i < ORB_CAPACITY; i++) s.pool.free[i] = ORB_CAPACITY - 1 - i;
  s.seed = seed;
  s.elapsed = 0;
  s.zone = arenaZone(0);
  s.peak = ARENA.startMass;
  s.score = 0;
  s.kills = 0;
  s.rank = 1;
  s.nextId = 0;
  s.count = 0;
  s.pelletCount = 0;
  s.powerCount = 0;
  s.over = false;
  s.perfect = false;
  s.reason = 0;
  s.noteKind = 0;
  s.noteName = 0;
  s.cmdX = 0;
  s.cmdY = 0;
  s.dashPending = false;
  s.stick = false;
  s.finger = -1;
  s.achievementMask = 0;
  spawn(s, ARENA.startMass, 0, 7);
  put(s, F.x, 0, ARENA.world / 2);
  put(s, F.y, 0, ARENA.world / 2);
  put(s, F.previousX, 0, ARENA.world / 2);
  put(s, F.previousY, 0, ARENA.world / 2);
  for (let i = 0; i < ARENA.bots; i++) spawn(s, 12 + random(s) * 40, 1 + (i % 13), i % 7);
  for (let i = 0; i < ARENA.pellets; i++) pellet(s);
  s.top.fill(255);
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    let j = i;
    while (j > 0 && orb(s, F.mass, s.sorted[j - 1]) < orb(s, F.mass, slot)) {
      s.sorted[j] = s.sorted[j - 1];
      j--;
    }
    s.sorted[j] = slot;
  }
  for (let i = 0; i < Math.min(3, s.count); i++) s.top[i] = s.sorted[i];
}
export function createArenaBuffers(seed: number, best = 0, baseKills = 0): ArenaBuffers {
  const s: ArenaBuffers = {
    orbs: new Float64Array(F.fields * ORB_CAPACITY),
    pool: createPool(ORB_CAPACITY),
    order: new Uint8Array(ORB_CAPACITY),
    sorted: new Uint8Array(ORB_CAPACITY),
    top: new Uint8Array(3),
    name: new Uint8Array(ORB_CAPACITY),
    color: new Uint8Array(ORB_CAPACITY),
    emoji: new Int8Array(ORB_CAPACITY),
    count: 0,
    pelletX: new Float64Array(260),
    pelletY: new Float64Array(260),
    pelletColor: new Uint8Array(260),
    pelletCount: 0,
    powerX: new Float64Array(4),
    powerY: new Float64Array(4),
    powerKind: new Uint8Array(4),
    powerCount: 0,
    seed,
    elapsed: 0,
    zone: 0,
    peak: 20,
    score: 0,
    kills: 0,
    rank: 1,
    nextId: 0,
    over: false,
    perfect: false,
    reason: 0,
    noteKind: 0,
    noteName: 0,
    cmdX: 0,
    cmdY: 0,
    dashPending: false,
    stick: false,
    stickX: 0,
    stickY: 0,
    finger: -1,
    spotX: 0,
    spotY: 0,
    brainX: 0,
    brainY: 0,
    brainDash: false,
    best,
    baseKills,
    achievementMask: 0,
  };
  resetArena(s, seed);
  return s;
}
function retarget(s: ArenaBuffers, slot: number) {
  'worklet';
  let best = -1,
    bd = Infinity;
  for (let i = 0; i < 12; i++) {
    const p = Math.floor(random(s) * s.pelletCount);
    if (p >= s.pelletCount) break;
    const d = distance(orb(s, F.x, slot), orb(s, F.y, slot), s.pelletX[p], s.pelletY[p]);
    if (d < bd) {
      best = p;
      bd = d;
    }
  }
  put(s, F.hx, slot, best >= 0 ? s.pelletX[best] - orb(s, F.x, slot) : random(s) - 0.5);
  put(s, F.hy, slot, best >= 0 ? s.pelletY[best] - orb(s, F.y, slot) : random(s) - 0.5);
  put(s, F.think, slot, 0.6 + random(s) * 0.8);
}
function bot(s: ArenaBuffers, me: number) {
  'worklet';
  const mass = orb(s, F.mass, me),
    r = radius(mass),
    x = orb(s, F.x, me),
    y = orb(s, F.y, me);
  let threat = -1,
    prey = -1,
    threatD = Infinity,
    preyD = Infinity;
  for (let i = 0; i < s.count; i++) {
    const o = s.order[i];
    if (o === me || !orb(s, F.alive, o)) continue;
    const d = distance(x, y, orb(s, F.x, o), orb(s, F.y, o)),
      m = orb(s, F.mass, o);
    if (m > mass * 1.15 && d < 160 + radius(m) && d < threatD) {
      threat = o;
      threatD = d;
    } else if (mass > m * 1.25 && orb(s, F.shield, o) <= 0 && d < 220 + r && d < preyD) {
      prey = o;
      preyD = d;
    }
  }
  const cx = ARENA.world / 2 - x,
    cy = ARENA.world / 2 - y;
  const out = Math.hypot(cx, cy) > s.zone - r - 40;
  s.brainDash = false;
  if (threat >= 0) {
    const dx = x - orb(s, F.x, threat),
      dy = y - orb(s, F.y, threat),
      n = Math.hypot(dx, dy) || 1,
      k = out ? 0.6 : 0;
    s.brainX = dx / n + (cx / (Math.hypot(cx, cy) || 1)) * k;
    s.brainY = dy / n + (cy / (Math.hypot(cx, cy) || 1)) * k;
    s.brainDash = threatD < radius(orb(s, F.mass, threat)) + r + 30 && mass > 30;
  } else if (out) {
    s.brainX = cx;
    s.brainY = cy;
  } else if (prey >= 0) {
    s.brainX = orb(s, F.x, prey) - x;
    s.brainY = orb(s, F.y, prey) - y;
    s.brainDash = preyD < r + 70 && mass > orb(s, F.mass, prey) * 1.6;
  } else {
    s.brainX = orb(s, F.hx, me);
    s.brainY = orb(s, F.hy, me);
  }
}
function move(s: ArenaBuffers, slot: number, dx: number, dy: number, dash: boolean, dt: number) {
  'worklet';
  const n = Math.hypot(dx, dy);
  if (dash && orb(s, F.dashCd, slot) <= 0 && orb(s, F.mass, slot) > ARENA.startMass) {
    put(s, F.mass, slot, orb(s, F.mass, slot) * (1 - ARENA.dashCost));
    put(s, F.dashCd, slot, ARENA.dashCd);
    put(s, F.dashT, slot, 0.28);
  }
  const mass = orb(s, F.mass, slot),
    sp = (260 / Math.pow(mass, 0.3)) * (orb(s, F.dashT, slot) > 0 ? 2.8 : 1) * Math.min(n, 1);
  const tx = n ? (dx / n) * sp : 0,
    ty = n ? (dy / n) * sp : 0,
    k = 1 - Math.exp(-8 * dt);
  const vx = orb(s, F.vx, slot) + (tx - orb(s, F.vx, slot)) * k,
    vy = orb(s, F.vy, slot) + (ty - orb(s, F.vy, slot)) * k;
  put(s, F.vx, slot, vx);
  put(s, F.vy, slot, vy);
  const r = radius(mass);
  put(s, F.x, slot, clamp(orb(s, F.x, slot) + vx * dt, r * 0.5, ARENA.world - r * 0.5));
  put(s, F.y, slot, clamp(orb(s, F.y, slot) + vy * dt, r * 0.5, ARENA.world - r * 0.5));
  for (let f = F.dashCd; f <= F.magnet; f++) put(s, f, slot, Math.max(0, orb(s, f, slot) - dt));
}
export function canEatSlots(s: ArenaBuffers, a: number, b: number) {
  'worklet';
  return (
    orb(s, F.mass, a) > orb(s, F.mass, b) * 1.15 &&
    orb(s, F.shield, b) <= 0 &&
    distance(orb(s, F.x, a), orb(s, F.y, a), orb(s, F.x, b), orb(s, F.y, b)) <
      radius(orb(s, F.mass, a)) - radius(orb(s, F.mass, b)) * 0.4
  );
}
/** Stable insertion order for equal masses: matches legacy stable Array.sort, in bounded workspace. */
function sortOrbs(s: ArenaBuffers): number {
  'worklet';
  let count = 0;
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    if (!orb(s, F.alive, slot)) continue;
    let j = count;
    while (j > 0 && orb(s, F.mass, s.sorted[j - 1]) < orb(s, F.mass, slot)) {
      s.sorted[j] = s.sorted[j - 1];
      j--;
    }
    s.sorted[j] = slot;
    count++;
  }
  return count;
}
/** Pure bounded legacy-equivalent tick. Same dt/input => bit-exact numerics; production supplies 1/120. */
export function stepArenaBuffers(s: ArenaBuffers, rawDt: number, events?: EventBus) {
  'worklet';
  const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 0;
  if (s.over || !dt) return;
  const previousTime = s.elapsed,
    previousScore = s.score,
    previousKills = s.kills;
  s.elapsed += dt;
  s.zone = arenaZone(s.elapsed);
  s.perfect = false;
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    if (!orb(s, F.alive, slot)) continue;
    put(s, F.previousX, slot, orb(s, F.x, slot));
    put(s, F.previousY, slot, orb(s, F.y, slot));
    if (orb(s, F.id, slot) === 0) move(s, slot, s.cmdX, s.cmdY, s.dashPending, dt);
    else {
      put(s, F.think, slot, orb(s, F.think, slot) - dt);
      if (orb(s, F.think, slot) <= 0) retarget(s, slot);
      bot(s, slot);
      move(s, slot, s.brainX, s.brainY, s.brainDash, dt);
    }
    const mass = orb(s, F.mass, slot);
    put(
      s,
      F.mass,
      slot,
      !inside(s, orb(s, F.x, slot), orb(s, F.y, slot))
        ? Math.max(5, mass - mass * 0.09 * dt - 2 * dt)
        : Math.max(ARENA.startMass * 0.5, mass - mass * 0.004 * dt),
    );
  }
  s.dashPending = false;
  let kept = 0;
  for (let p = 0; p < s.pelletCount; p++) {
    let x = s.pelletX[p],
      y = s.pelletY[p],
      eaten = false;
    for (let i = 0; i < s.count; i++) {
      const slot = s.order[i];
      if (!orb(s, F.alive, slot)) continue;
      const ox = orb(s, F.x, slot),
        oy = orb(s, F.y, slot),
        r = radius(orb(s, F.mass, slot)),
        d = distance(ox, oy, x, y);
      if (orb(s, F.magnet, slot) > 0 && d < r + 110 && d > 1) {
        x += ((ox - x) / d) * 260 * dt;
        y += ((oy - y) / d) * 260 * dt;
      }
      if (d < r) {
        put(s, F.mass, slot, orb(s, F.mass, slot) + 1);
        eaten = true;
        break;
      }
    }
    if (!eaten) {
      s.pelletX[kept] = x;
      s.pelletY[kept] = y;
      s.pelletColor[kept] = s.pelletColor[p];
      kept++;
    }
  }
  s.pelletCount = kept;
  while (s.pelletCount < ARENA.pellets) pellet(s);
  if (Math.floor(s.elapsed / ARENA.powerEvery) > Math.floor(previousTime / ARENA.powerEvery) && s.powerCount < 4) {
    zoneSpot(s);
    const p = s.powerCount++;
    s.powerX[p] = s.spotX;
    s.powerY[p] = s.spotY;
    s.powerKind[p] = Math.floor(random(s) * 3);
  }
  kept = 0;
  for (let p = 0; p < s.powerCount; p++) {
    let taker = -1;
    for (let i = 0; i < s.count; i++) {
      const slot = s.order[i];
      if (
        orb(s, F.alive, slot) &&
        distance(orb(s, F.x, slot), orb(s, F.y, slot), s.powerX[p], s.powerY[p]) < radius(orb(s, F.mass, slot)) + 8
      ) {
        taker = slot;
        break;
      }
    }
    if (taker < 0) {
      s.powerX[kept] = s.powerX[p];
      s.powerY[kept] = s.powerY[p];
      s.powerKind[kept++] = s.powerKind[p];
    } else {
      const kind = s.powerKind[p];
      if (kind === 0) put(s, F.shield, taker, 5);
      else if (kind === 1) put(s, F.magnet, taker, 7);
      else put(s, F.mass, taker, orb(s, F.mass, taker) * 1.25);
      if (orb(s, F.id, taker) === 0) s.noteKind = kind + 1;
    }
  }
  s.powerCount = kept;
  const sortedCount = sortOrbs(s);
  for (let i = 0; i < sortedCount; i++) {
    const a = s.sorted[i];
    if (!orb(s, F.alive, a)) continue;
    for (let j = 0; j < sortedCount; j++) {
      const b = s.sorted[j];
      if (a === b || !orb(s, F.alive, b) || !canEatSlots(s, a, b)) continue;
      put(s, F.mass, a, orb(s, F.mass, a) + orb(s, F.mass, b) * 0.85);
      put(s, F.alive, b, 0);
      if (orb(s, F.id, a) === 0) {
        s.kills++;
        s.perfect = true;
        s.noteKind = 4;
        s.noteName = s.name[b];
      }
    }
  }
  kept = 0;
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    if (orb(s, F.alive, slot) || orb(s, F.id, slot) === 0) s.order[kept++] = slot;
    else release(s.pool, slot);
  }
  s.count = kept;
  const wanted = s.zone > 400 ? ARENA.bots : Math.max(4, Math.round((ARENA.bots * s.zone) / 400));
  if (s.count - 1 < wanted && random(s) < dt * 0.8) {
    const id = s.nextId;
    spawn(s, 12 + random(s) * Math.min(20 + s.elapsed / 2, 90), 1 + (id % 13), id % 7);
  }
  s.peak = Math.max(s.peak, orb(s, F.mass, 0));
  s.score = Math.floor(s.peak);
  s.rank = 1;
  for (let i = 0; i < s.count; i++) {
    const slot = s.order[i];
    if (orb(s, F.id, slot) !== 0 && orb(s, F.mass, slot) > orb(s, F.mass, 0)) s.rank++;
  }
  if (!orb(s, F.alive, 0)) {
    s.over = true;
    s.reason = 1;
  } else if (s.elapsed >= ARENA.matchTime) {
    s.over = true;
    s.reason = 2;
    s.score += Math.max(0, 6 - s.rank) * 25;
  }
  const leaders = sortOrbs(s);
  s.top.fill(255);
  for (let i = 0; i < Math.min(3, leaders); i++) s.top[i] = s.sorted[i];
  if (!events) return;
  if (s.kills > previousKills) emitEvent(events, EventKind.hit, s.kills, s.score > previousScore ? 1 : 0);
  if (s.score > previousScore) emitEvent(events, EventKind.score, s.score);
  if (s.score > s.best) {
    s.best = s.score;
    emitEvent(events, EventKind.newBest, s.score);
  }
  if (!(s.achievementMask & 1) && s.baseKills + s.kills >= 10) {
    s.achievementMask |= 1;
    emitEvent(events, EventKind.achievementUnlocked, 6);
  }
  if (!(s.achievementMask & 2) && s.score >= 300) {
    s.achievementMask |= 2;
    emitEvent(events, EventKind.achievementUnlocked, 7);
  }
  if (s.over) {
    const win = s.rank === 1 && s.elapsed >= ARENA.matchTime;
    if (win) emitEvent(events, EventKind.achievementUnlocked, 8);
    emitEvent(events, EventKind.gameOver, s.score, win ? 1 : 0);
  }
}
export function arenaInput(s: ArenaBuffers, type: 'down' | 'move' | 'up' | 'action', x = 0, y = 0) {
  'worklet';
  if (s.over) return;
  if (type === 'action') {
    s.dashPending = true;
    return;
  }
  if (type === 'up') {
    s.stick = false;
    s.cmdX = 0;
    s.cmdY = 0;
    return;
  }
  if (type === 'down' || !s.stick) {
    s.stick = true;
    s.stickX = x;
    s.stickY = y;
  }
  const dx = x - s.stickX,
    dy = y - s.stickY,
    n = Math.hypot(dx, dy),
    k = n < 4 ? 0 : Math.min(n / 40, 1) / n;
  s.cmdX = dx * k;
  s.cmdY = dy * k;
}
export function arenaTick(s: ArenaBuffers, input: InputState, dt: number, _tick: number, events: EventBus) {
  'worklet';
  if (input.cancelled) {
    arenaInput(s, 'up');
    s.finger = -1;
  }
  if (!input.cancelled && s.finger < 0)
    for (let i = 0; i < input.active.length; i++) {
      if (input.down & (1 << i)) {
        s.finger = i;
        arenaInput(s, 'down', input.startX[i], input.startY[i]);
        break;
      }
    }
  if (s.finger >= 0) {
    const slot = s.finger;
    if (input.up & (1 << slot)) {
      arenaInput(s, 'up');
      s.finger = -1;
    } else if (input.active[slot]) arenaInput(s, 'move', input.x[slot], input.y[slot]);
  }
  stepArenaBuffers(s, dt, events);
}
