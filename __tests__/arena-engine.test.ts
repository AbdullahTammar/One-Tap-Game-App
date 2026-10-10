import {
  createArenaBuffers,
  stepArenaBuffers,
  arenaInput,
  arenaTick,
  orb,
  put,
  radius,
  F,
  arenaZone,
  canEatSlots,
  ORB_CAPACITY,
  ARENA_EVENT_BUDGET,
} from '../src/game/arena/engine';
import { ARENA, zoneRadius, canEat, createArena } from '../src/game/motion/arena';
import { createEventBus, EventKind, takeBatch } from '../src/game/core/events';
import { createInput, writeTouch } from '../src/game/core/input';
import { acquire, release } from '../src/game/core/memory';

test('fixed buffers and pool capacity are stable; slots exhaust and reuse', () => {
  const s = createArenaBuffers(42),
    arrays = [s.orbs, s.pelletX, s.pelletY, s.powerX, s.sorted];
  expect(s.count).toBe(ARENA.bots + 1);
  expect(s.pelletCount).toBe(260);
  expect(ORB_CAPACITY).toBe(32);
  for (let i = 0; i < 10; i++) stepArenaBuffers(s, 1 / 120);
  [s.orbs, s.pelletX, s.pelletY, s.powerX, s.sorted].forEach((buffer, i) => expect(buffer).toBe(arrays[i]));
  while (acquire(s.pool) >= 0) {
    /* bounded pool exhaustion */
  }
  expect(s.pool.count).toBe(32);
  expect(release(s.pool, 31)).toBe(true);
  expect(acquire(s.pool)).toBe(31);
});
test('dash latch survives pointer up, costs 12%, and cooldown/timers advance at fixed dt', () => {
  const s = createArenaBuffers(1);
  s.count = 1;
  s.pelletX.fill(1300);
  s.pelletY.fill(1300);
  put(s, F.mass, 0, 100);
  put(s, F.magnet, 0, 7);
  put(s, F.shield, 0, 5);
  arenaInput(s, 'down', 0, 0);
  arenaInput(s, 'move', 40, 0);
  arenaInput(s, 'action');
  arenaInput(s, 'up');
  expect(s.dashPending).toBe(true);
  stepArenaBuffers(s, 1 / 120);
  expect(orb(s, F.mass, 0)).toBeCloseTo(88 - (88 * 0.004) / 120);
  expect(orb(s, F.dashCd, 0)).toBeCloseTo(2.5 - 1 / 120);
  expect(orb(s, F.shield, 0)).toBeCloseTo(5 - 1 / 120);
  expect(orb(s, F.magnet, 0)).toBeCloseTo(7 - 1 / 120);
  expect(s.dashPending).toBe(false);
});
test('canEat preserves shield and mass rules; zone shrinks and floors at 170', () => {
  const s = createArenaBuffers(42),
    legacy = createArena(42);
  for (let elapsed = 0; elapsed <= 500; elapsed += 5) expect(arenaZone(elapsed)).toBe(zoneRadius(elapsed));
  expect(arenaZone(500)).toBe(170);
  expect(radius(100)).toBe(40);
  expect(canEatSlots(s, 0, 1)).toBe(canEat(legacy.orbs[0], legacy.orbs[1]));
  put(s, F.mass, 0, 100);
  put(s, F.mass, 1, 5);
  put(s, F.x, 1, 700);
  put(s, F.y, 1, 700);
  put(s, F.shield, 1, 0);
  expect(canEatSlots(s, 0, 1)).toBe(true);
  put(s, F.shield, 1, 1);
  expect(canEatSlots(s, 0, 1)).toBe(false);
});
test('kill emits cumulative total before final report; terminal event budget stays within declaration', () => {
  const s = createArenaBuffers(42),
    bus = createEventBus();
  put(s, F.mass, 0, 2000);
  put(s, F.shield, 0, 1000);
  for (let i = 1; i < s.count; i++) {
    const slot = s.order[i];
    put(s, F.x, slot, 700);
    put(s, F.y, slot, 700);
    put(s, F.mass, slot, 5);
    put(s, F.shield, slot, 0);
  }
  s.elapsed = 180 - 1 / 120;
  stepArenaBuffers(s, 1 / 120, bus);
  expect(s.over).toBe(true);
  expect(s.kills).toBe(11);
  expect(s.rank).toBe(1);
  expect(s.score).toBe(Math.floor(s.peak) + 125);
  expect(bus.journal.count).toBeLessThanOrEqual(ARENA_EVENT_BUDGET);
  const batch = takeBatch(bus)!;
  expect(batch[batch.length - 3]).toBe(EventKind.gameOver);
  expect(batch[2]).toBe(EventKind.hit);
  expect(batch[3]).toBe(11);
});
test('cancel clears joystick without resurrecting an unconsumed down latch; invalid times do nothing', () => {
  const s = createArenaBuffers(42),
    input = createInput(),
    bus = createEventBus();
  writeTouch(input, 1, 0, 0, 0, 0);
  input.cancelled = true;
  arenaTick(s, input, 1 / 120, 0, bus);
  expect(s.stick).toBe(false);
  expect(s.finger).toBe(-1);
  const elapsed = s.elapsed;
  for (const dt of [NaN, Infinity, 0, -1]) stepArenaBuffers(s, dt);
  expect(s.elapsed).toBe(elapsed);
});
