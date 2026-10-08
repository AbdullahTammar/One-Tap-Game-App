import { createMotion, inputMotion, MOTION_GAMES, stepMotion, type MotionId } from '../src/game/motion';
import { ARENA, canEat, createArena, inputArena, stepArena, zoneRadius, type Orb } from '../src/game/motion/arena';
import { createChain, inputChain, stepChain } from '../src/game/motion/chain';
import { CHARGE, createCharge, inputCharge, stepCharge } from '../src/game/motion/charge';
import { createDrift, DRIFT, inputDrift, stepDrift } from '../src/game/motion/drift';
import { createDuel, inputDuel, stepDuel, type DuelState } from '../src/game/motion/duel';
import { capture, createPaint, inputPaint, PAINT, stepPaint } from '../src/game/motion/paint';
import { createStack, inputStack, STACK, stepStack } from '../src/game/motion/stack';
import { cellCenter, createFlow, FLOW, inputFlow, stepFlow } from '../src/game/motion/flow';
import { createSwipe, inputSwipe, stepSwipe, swipeDir, visibleColor } from '../src/game/motion/swipe';
import { createTilt, inputTilt, stepTilt, TILT } from '../src/game/motion/tilt';

const run = <T extends { phase: string }>(s: T): T => ({ ...s, phase: 'running' });
const ids = MOTION_GAMES.map((g) => g.id) as MotionId[];

describe('shared motion rules', () => {
  test.each(ids)('%s is deterministic for a seed', (id) => {
    const a = createMotion(id, 42);
    const b = createMotion(id, 42);
    expect(a).toEqual(b);
    expect(stepMotion(id, run(a), 0.016)).toEqual(stepMotion(id, run(b), 0.016));
  });
  test.each(ids)('%s ignores input and time until started, and bad frame times', (id) => {
    const s = createMotion(id, 1);
    expect(stepMotion(id, s, 0.1)).toBe(s);
    expect(inputMotion(id, s, { type: 'down', x: 100, y: 100 })).toBe(s);
    const r = run(s);
    for (const dt of [NaN, -1, 0, Infinity]) expect(stepMotion(id, r, dt)).toBe(r);
  });
  test.each(ids)('%s survives a long random session with valid scores', (id) => {
    let s = run(createMotion(id, 9));
    for (let i = 0; i < 2000 && s.phase === 'running'; i++) {
      const x = (i * 37) % 320;
      const y = (i * 91) % 320;
      s = inputMotion(id, s, { type: i % 15 === 0 ? 'down' : i % 15 === 14 ? 'up' : 'move', x, y });
      if (i % 50 === 0) s = inputMotion(id, s, { type: 'action' });
      s = stepMotion(id, s, 1 / 60);
      expect(Number.isSafeInteger(s.score) && s.score >= 0).toBe(true);
    }
  });
});

test('drift: relative drag moves the dot, gold builds combos, enemies end the run', () => {
  let s = run(createDrift(3));
  s = { ...s, gold: { x: 200, y: 160 } };
  s = inputDrift(s, { type: 'down', x: 10, y: 10 });
  s = inputDrift(s, { type: 'move', x: 50, y: 10 });
  expect(s).toMatchObject({ x: 200, y: 160, score: 1, combo: 1 });
  s = { ...s, gold: { x: 200, y: 180 } };
  s = inputDrift(s, { type: 'move', x: 50, y: 30 });
  expect(s).toMatchObject({ score: 3, combo: 2 });
  expect(stepDrift({ ...s, comboTimer: 0.01 }, 0.02).combo).toBe(0);
  const hit = { ...s, enemies: [{ x: s.x + DRIFT.player, y: s.y, vx: 0, vy: 0 }] };
  expect(stepDrift(hit, 0.016).phase).toBe('over');
});

test('charge: release distance must land on the pad; overcharge burns out', () => {
  const s = run(createCharge(5));
  const holdFor = (secs: number) => {
    let c = inputCharge(s, { type: 'down', x: 0, y: 0 });
    c = stepCharge(c, 0.0001);
    c = { ...c, charge: secs / CHARGE.fullTime };
    c = inputCharge(c, { type: 'up', x: 0, y: 0 });
    for (let i = 0; i < 40; i++) c = stepCharge(c, 0.02);
    return c;
  };
  const exact = holdFor((s.gap / CHARGE.maxJump) * CHARGE.fullTime);
  expect(exact).toMatchObject({ phase: 'running', score: 2, perfect: true, mode: 'aim' });
  expect(holdFor(0.01).phase).toBe('over');
  let burnt = inputCharge(s, { type: 'down', x: 0, y: 0 });
  for (let i = 0; i < 160; i++) burnt = stepCharge(burnt, 0.02);
  expect(burnt).toMatchObject({ phase: 'over', note: 'Overcharged!' });
});

test('swipe: matching gate scores, wrong gate and timeouts end the run', () => {
  expect([swipeDir(0, -40), swipeDir(40, 0), swipeDir(0, 40), swipeDir(-40, 0), swipeDir(5, 5)]).toEqual([
    0,
    1,
    2,
    3,
    null,
  ]);
  const s = run(createSwipe(11));
  const dirOf = (c: number) => s.gates.indexOf(c);
  const swipe = (state: typeof s, dir: number) => {
    const v = [
      [0, -50],
      [50, 0],
      [0, 50],
      [-50, 0],
    ][dir];
    const d = inputSwipe(state, { type: 'down', x: 160, y: 160 });
    return inputSwipe(d, { type: 'up', x: 160 + v[0], y: 160 + v[1] });
  };
  expect(swipe(s, dirOf(visibleColor(s)))).toMatchObject({ score: 1, perfect: true });
  expect(swipe(s, (dirOf(visibleColor(s)) + 1) % 4).phase).toBe('over');
  expect(stepSwipe(s, 0.05 + s.window).phase).toBe('running');
  let t = s;
  for (let i = 0; i < 60; i++) t = stepSwipe(t, 0.05);
  expect(t.phase).toBe('over');
  const trick = { ...s, trickTo: (s.color + 1) % 4, timer: s.window * 0.4 };
  expect(visibleColor(trick)).toBe(trick.trickTo);
});

test('chain: one spark per level; reaching the goal advances, missing ends', () => {
  const s = run(createChain(4));
  const d = s.dots[0];
  let c = inputChain(s, { type: 'down', x: d.x, y: d.y });
  expect(inputChain(c, { type: 'down', x: 1, y: 1 })).toBe(c);
  for (let i = 0; i < 200 && c.mode === 'blasting'; i++) c = stepChain(c, 0.02);
  expect(c.popped).toBeGreaterThanOrEqual(1);
  const win = stepChain({ ...c, phase: 'running', mode: 'blasting', popped: c.goal, dots: [] }, 0.02);
  expect(win.mode).toBe('cleared');
  let lv = win;
  for (let i = 0; i < 30; i++) lv = stepChain(lv, 0.05);
  expect(lv).toMatchObject({ level: 2, mode: 'aim' });
  expect(stepChain({ ...c, phase: 'running', mode: 'blasting', popped: 0, dots: [] }, 0.02).phase).toBe('over');
});

test('flow: chains, loops, backtracking and the clock', () => {
  const s = run(createFlow(2));
  const grid = s.grid.map(() => 1);
  grid[0] = 0;
  grid[1] = 0;
  grid[6] = 0;
  grid[7] = 0;
  const base = { ...s, grid };
  const at = (i: number) => cellCenter(i);
  let f = inputFlow(base, { type: 'down', ...at(0) });
  f = inputFlow(f, { type: 'move', ...at(1) });
  f = inputFlow(f, { type: 'move', ...at(2) });
  expect(f.path).toEqual([0, 1]);
  f = inputFlow(f, { type: 'move', ...at(0) });
  expect(f.path).toEqual([0]);
  f = inputFlow(f, { type: 'move', ...at(1) });
  f = inputFlow(f, { type: 'move', ...at(7) });
  f = inputFlow(f, { type: 'move', ...at(6) });
  f = inputFlow(f, { type: 'move', ...at(0) });
  expect(f.loop).toBe(true);
  const done = inputFlow(f, { type: 'up', x: 0, y: 0 });
  expect(done).toMatchObject({ score: 4, perfect: true, path: [] });
  expect(done.grid).toHaveLength(FLOW.size * FLOW.size);
  expect(stepFlow({ ...base, timeLeft: 0.01 }, 0.02).phase).toBe('over');
});

test('tilt: walls block, gaps let the orb out, escaping scores', () => {
  let s = run(createTilt(8));
  // Close every gap away from the right side, then roll right.
  s = { ...s, rings: s.rings.map((g) => ({ ...g, gap: Math.PI, spin: 0 })) };
  let blocked = inputTilt(s, { type: 'tilt', x: 1, y: 0 });
  for (let i = 0; i < 120; i++) blocked = stepTilt(blocked, 1 / 60);
  expect(Math.hypot(blocked.x - 160, blocked.y - 160)).toBeLessThanOrEqual(50);
  let open = { ...s, rings: s.rings.map((g) => ({ ...g, gap: 0, spin: 0 })) };
  open = inputTilt(open, { type: 'tilt', x: 1, y: 0 });
  for (let i = 0; i < 240 && open.score === 0; i++) open = stepTilt(open, 1 / 60);
  expect(open).toMatchObject({ score: 1, level: 2, x: 160, y: 160 });
  expect(stepTilt({ ...s, timeLeft: 0.01 }, 0.02).phase).toBe('over');
  expect(TILT.exit).toBeGreaterThan(130);
});

describe('arena', () => {
  const orb = (o: Partial<Orb>): Orb => ({
    id: 1,
    name: 'a',
    color: '#fff',
    x: 0,
    y: 0,
    mass: 20,
    vx: 0,
    vy: 0,
    dashCd: 0,
    dashT: 0,
    shield: 0,
    magnet: 0,
    alive: true,
    think: 0,
    hx: 0,
    hy: 0,
    ...o,
  });
  test('eating needs a clear size lead, overlap and no shield', () => {
    expect(canEat(orb({ mass: 100 }), orb({ mass: 50, x: 5 }))).toBe(true);
    expect(canEat(orb({ mass: 100 }), orb({ mass: 90 }))).toBe(false);
    expect(canEat(orb({ mass: 100 }), orb({ mass: 50, x: 60 }))).toBe(false);
    expect(canEat(orb({ mass: 100 }), orb({ mass: 50, shield: 1 }))).toBe(false);
  });
  test('zone shrinks over time and has a floor', () => {
    expect(zoneRadius(0)).toBeGreaterThan(zoneRadius(100));
    expect(zoneRadius(10000)).toBe(170);
  });
  test('joystick steers the player and dash spends mass', () => {
    let s = run(createArena(1));
    s.orbs[0].mass = 60;
    s = inputArena(s, { type: 'down', x: 100, y: 100 });
    s = inputArena(s, { type: 'move', x: 160, y: 100 });
    expect(s.cmd.dx).toBeCloseTo(1);
    s = inputArena(s, { type: 'action' });
    const x0 = s.orbs[0].x;
    s = stepArena(s, 0.05);
    expect(s.orbs[0].x).toBeGreaterThan(x0);
    expect(s.orbs[0].mass).toBeLessThan(60);
    expect(s.cmd.dash).toBe(false);
  });
  test('being eaten ends the run; the clock ends the match with a rank bonus', () => {
    const s = run(createArena(2));
    const me = s.orbs[0];
    const big = { ...s.orbs[1], x: me.x, y: me.y, mass: 500, shield: 0 };
    const eaten = stepArena({ ...s, orbs: [{ ...me, shield: 0 }, big] }, 0.016);
    expect(eaten.phase).toBe('over');
    const end = stepArena({ ...s, elapsed: ARENA.matchTime - 0.01, orbs: [{ ...me, mass: 999 }] }, 0.02);
    expect(end).toMatchObject({ phase: 'over', rank: 1 });
    expect(end.score).toBeGreaterThanOrEqual(999 + 125);
  });
});

test('stack: daring releases score more, touching the stack ends the run', () => {
  let s = run(createStack(1));
  s = inputStack(s, { type: 'down', x: 0, y: 0 });
  s = { ...s, cur: STACK.outer - STACK.thick - 2 };
  s = inputStack(s, { type: 'up', x: 0, y: 0 });
  expect(s).toMatchObject({ score: 3, perfect: true, rings: [STACK.outer - STACK.thick - 2] });
  s = inputStack(s, { type: 'down', x: 0, y: 0 });
  s = { ...s, cur: 40 };
  s = inputStack(s, { type: 'up', x: 0, y: 0 });
  expect(s.score).toBe(4);
  s = inputStack(s, { type: 'down', x: 0, y: 0 });
  for (let i = 0; i < 200 && s.phase === 'running'; i++) s = stepStack(s, 0.02);
  expect(s.phase).toBe('over');
  const tiny = inputStack(inputStack(run(createStack(1)), { type: 'down', x: 0, y: 0 }), { type: 'up', x: 0, y: 0 });
  expect(tiny).toMatchObject({ score: 0, note: 'Too small' });
  let full = { ...run(createStack(1)), rings: [30], holding: true, cur: 14 };
  full = inputStack(full, { type: 'up', x: 0, y: 0 });
  expect(full).toMatchObject({ level: 2, rings: [] });
});

test('duel: each half steers its own paddle; goals count and five wins', () => {
  let s: DuelState = { ...run(createDuel(3)), mode: 'duo', serve: 0 };
  s = inputDuel(s, {
    type: 'touches',
    points: [
      { x: 50, y: 300 },
      { x: 250, y: 20 },
    ],
  });
  for (let i = 0; i < 30; i++) s = stepDuel(s, 1 / 60);
  expect(s.paddles[0].x).toBeLessThan(100);
  expect(s.paddles[1].x).toBeGreaterThan(220);
  const bot = inputDuel({ ...run(createDuel(3)) }, { type: 'touches', points: [{ x: 250, y: 20 }] });
  expect(bot.targets[1]).toBeNull();
  const goal = stepDuel({ ...s, puck: { x: 160, y: -20, vx: 0, vy: -100 }, goals: [4, 2] }, 0.016);
  expect(goal).toMatchObject({ phase: 'over', winner: 0, score: 5 });
  const conceded = stepDuel({ ...s, puck: { x: 160, y: 340, vx: 0, vy: 100 } }, 0.016);
  expect(conceded.goals).toEqual([0, 1]);
  expect(conceded.serve).toBeGreaterThan(0);
  const wall = stepDuel({ ...s, puck: { x: 5, y: 160, vx: -200, vy: 0 } }, 0.016);
  expect(wall.puck.vx).toBeGreaterThan(0);
});

describe('paint', () => {
  test('closing a loop claims the enclosed land', () => {
    const s = createPaint(1, 'Tammar');
    expect(s.painters[0].name).toBe('Tammar');
    const owner = s.owner.map(() => -1);
    const trail = s.trail.map(() => -1);
    const N = PAINT.size;
    owner[5 * N + 5] = 0;
    for (const [x, y] of [
      [6, 5],
      [7, 5],
      [7, 6],
      [7, 7],
      [6, 7],
      [5, 7],
      [5, 6],
    ])
      trail[y * N + x] = 0;
    const t = { ...s, owner, trail };
    capture(t, 0);
    expect(t.owner[6 * N + 6]).toBe(0);
    expect(t.owner.filter((o) => o === 0)).toHaveLength(9);
    expect(t.trail.every((v) => v === -1)).toBe(true);
  });
  test('swipes steer without reversing, and crossing your own trail ends the run', () => {
    let s = run(createPaint(2));
    s = inputPaint(s, { type: 'down', x: 100, y: 100 });
    s = inputPaint(s, { type: 'move', x: 140, y: 100 });
    expect(s.painters[0].next).toBe(1);
    // Heading up (0): a swipe down would reverse into your own trail, so it is ignored.
    const back = inputPaint(inputPaint(s, { type: 'down', x: 100, y: 100 }), { type: 'move', x: 100, y: 140 });
    expect(back.painters[0].next).toBe(1);
    const me = s.painters[0];
    const trail = s.trail.slice();
    trail[(me.y - 1) * PAINT.size + me.x] = 0;
    let out = { ...s, trail, painters: [{ ...me, dir: 0 as const, next: 0 as const }, ...s.painters.slice(1)] };
    for (let k = 0; k < 4; k++) out = stepPaint(out, 0.05);
    expect(out.phase).toBe('over');
  });
  test('the match ends on time with a rank', () => {
    const end = stepPaint({ ...run(createPaint(4)), timeLeft: 0.01 }, 0.02);
    expect(end.phase).toBe('over');
    expect(end.rank).toBeGreaterThanOrEqual(1);
  });
});
