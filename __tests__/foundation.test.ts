import {
  createClock,
  DEFAULT_CLOCK,
  pauseClock,
  planFrame,
  resetClock,
  resumeClock,
  validateClock,
} from '../src/game/core/clock';
import { sweepAABB, sweepCircles, sweepSegment } from '../src/game/core/collision';
import {
  acknowledgeBatch,
  beginSession,
  createEventBus,
  createEventReceiver,
  emitEvent,
  EventKind,
  hasEventRoom,
  takeBatch,
} from '../src/game/core/events';
import { appendPath, clearInput, createInput, swipeDirection, writeTouch } from '../src/game/core/input';
import { acquire, createPool, createRing, popSlots, pushSlot, release } from '../src/game/core/memory';
import { createProbe, sampleFrame, summarizeProbe } from '../src/game/core/probe';

describe('fixed clock', () => {
  test('spikes clamp, substep work is bounded and fractional remainder survives', () => {
    const c = createClock(),
      config = { step: 0.01, maxDelta: 0.055, maxSubsteps: 3 };
    resumeClock(c);
    expect(planFrame(c, 10, config)).toBe(0);
    expect(planFrame(c, 1, config)).toBe(3);
    expect(c.alpha).toBeCloseTo(0.5);
    expect(c.dropped).toBeCloseTo(0.965);
    expect(planFrame(c, 0.005, config)).toBe(1);
    expect(c.alpha).toBeCloseTo(0);
  });
  test('pause and resume discard background delta and reset starts paused', () => {
    const c = createClock();
    resumeClock(c);
    planFrame(c, 0.01, DEFAULT_CLOCK);
    expect(planFrame(c, 1 / 60, DEFAULT_CLOCK)).toBe(2);
    pauseClock(c);
    expect(planFrame(c, 30, DEFAULT_CLOCK)).toBe(0);
    resumeClock(c);
    expect(planFrame(c, 30, DEFAULT_CLOCK)).toBe(0);
    expect(planFrame(c, 1 / 120, DEFAULT_CLOCK)).toBe(1);
    resetClock(c);
    expect(c.paused).toBe(true);
    expect(c.tick).toBe(0);
    expect(c.alpha).toBe(0);
  });
  test('fixed tick inputs give equivalent simulations across frame partitions', () => {
    function simulate(frames: number[]) {
      const c = createClock();
      resumeClock(c);
      planFrame(c, 0, DEFAULT_CLOCK);
      let x = 0,
        v = 0;
      for (const dt of frames) {
        const count = planFrame(c, dt, DEFAULT_CLOCK);
        for (let i = 0; i < count; i++) {
          v += ((c.tick % 3) - 1) * DEFAULT_CLOCK.step;
          x += v * DEFAULT_CLOCK.step;
          c.tick++;
        }
      }
      return { x, v, tick: c.tick };
    }
    expect(simulate(new Array(120).fill(1 / 120))).toEqual(simulate(new Array(60).fill(1 / 60)));
  });
  test('invalid deltas and configuration', () => {
    const c = createClock();
    resumeClock(c);
    planFrame(c, 0, DEFAULT_CLOCK);
    for (const dt of [NaN, Infinity, -1, 0]) expect(planFrame(c, dt, DEFAULT_CLOCK)).toBe(0);
    expect(() => validateClock({ step: 0, maxDelta: 1, maxSubsteps: 3 })).toThrow();
    expect(() => validateClock({ step: 0.01, maxDelta: 1, maxSubsteps: 1.5 })).toThrow();
  });
});
describe('continuous collisions', () => {
  test('Duel puck at 28 units per step hits moving paddle despite separated endpoints', () => {
    // Relative travel is 78 units: initial and final center separation both exceed combined radius 31.
    const t = sweepCircles(0, 0, 28, 0, 11, 50, 0, -50, 0, 20);
    expect(t).toBeCloseTo(19 / 78);
  });
  test('stationary circles, overlap, tangent and miss', () => {
    expect(sweepCircles(0, 0, 0, 0, 1, 4, 0, 0, 0, 1)).toBe(Infinity);
    expect(sweepCircles(0, 0, 0, 0, 1, 1, 0, 0, 0, 1)).toBe(0);
    expect(sweepCircles(-5, 2, 10, 0, 1, 0, 0, 0, 0, 1)).toBeCloseTo(0.5);
    expect(sweepCircles(-5, 3, 10, 0, 1, 0, 0, 0, 0, 1)).toBe(Infinity);
  });
  test('28-unit puck displacement sweeps through thin segment and box', () => {
    expect(sweepSegment(0, 0, 28, 0, 11, 20, -40, 20, 40)).toBeCloseTo(9 / 28);
    expect(sweepAABB(0, 0, 28, 0, 11, 20, -40, 21, 40)).toBeCloseTo(9 / 28);
  });
  test('segment caps, degeneracy, initial overlap, box corner false positives', () => {
    expect(sweepSegment(-4, -1, 8, 0, 1, 0, 0, 0, 5)).toBeCloseTo(0.5);
    expect(sweepSegment(-4, 0, 8, 0, 1, 0, 0, 0, 0)).toBeCloseTo(3 / 8);
    expect(sweepSegment(0, 2, 0, 0, 1, 0, 0, 0, 5)).toBe(0);
    expect(sweepAABB(-0.9, -0.9, 0.1, 0, 1, 0, 0, 10, 10)).toBe(Infinity);
    expect(sweepAABB(5, 5, 0, 0, 1, 0, 0, 10, 10)).toBe(0);
  });
});
describe('event journal: small payloads and no loss/duplicate delivery', () => {
  test('coalesces display updates, retains critical order and terminal event once', () => {
    const bus = createEventBus();
    emitEvent(bus, EventKind.score, 1);
    emitEvent(bus, EventKind.score, 2);
    emitEvent(bus, EventKind.newBest, 2);
    emitEvent(bus, EventKind.newBest, 2);
    emitEvent(bus, EventKind.achievementUnlocked, 4);
    emitEvent(bus, EventKind.achievementUnlocked, 4);
    emitEvent(bus, EventKind.gameOver, 2, 7);
    emitEvent(bus, EventKind.gameOver, 2, 7);
    const events: string[] = [],
      receiver = createEventReceiver((e) => events.push(e.type));
    const batch = takeBatch(bus)!;
    expect(batch.length).toBe(20);
    expect(batch[3]).toBe(2);
    const last = receiver(batch);
    receiver(batch);
    expect(events).toEqual(['score', 'newBest', 'achievementUnlocked', 'gameOver']);
    acknowledgeBatch(bus, last);
    acknowledgeBatch(bus, last);
    expect(bus.journal.count).toBe(0);
  });
  test('stalled RN never overwrites events; reset retains pending persistence', () => {
    const bus = createEventBus(4);
    for (let i = 0; i < 4; i++) expect(emitEvent(bus, EventKind.newBest, i)).toBe(true);
    expect(hasEventRoom(bus, 1)).toBe(false);
    expect(emitEvent(bus, EventKind.gameOver, 4)).toBe(false);
    expect(bus.terminal).toBe(false);
    const batch = takeBatch(bus)!;
    expect(takeBatch(bus)).toBeNull();
    beginSession(bus);
    acknowledgeBatch(bus, 999);
    expect(bus.journal.count).toBe(4);
    acknowledgeBatch(bus, batch[15]);
    expect(emitEvent(bus, EventKind.gameOver, 4)).toBe(true);
    expect(takeBatch(bus)![1]).toBe(2);
  });
  test('in-flight updates are immutable, wrapped journals drain all events', () => {
    const bus = createEventBus(4),
      got: number[] = [];
    const receiver = createEventReceiver((e) => {
      if (e.type === 'newBest') got.push(e.value);
    });
    for (let i = 0; i < 100; i++) {
      emitEvent(bus, EventKind.newBest, i);
      const batch = takeBatch(bus, 1)!;
      const last = receiver(batch);
      acknowledgeBatch(bus, last);
    }
    expect(got).toEqual(Array.from({ length: 100 }, (_, i) => i));
    emitEvent(bus, EventKind.score, 1);
    const first = takeBatch(bus)!;
    emitEvent(bus, EventKind.score, 2);
    expect(first[3]).toBe(1);
    expect(bus.journal.count).toBe(2);
  });
  test('failed handler retries immutable batch and suppresses already successful events', () => {
    const bus = createEventBus(),
      got: string[] = [];
    let fail = true;
    emitEvent(bus, EventKind.newBest, 4);
    emitEvent(bus, EventKind.gameOver, 4);
    const receiver = createEventReceiver((e) => {
      if (e.type === 'gameOver' && fail) throw new Error('Persistence unavailable');
      got.push(e.type);
    });
    const first = takeBatch(bus)!;
    expect(() => receiver(first)).toThrow();
    bus.retry = true;
    const retry = takeBatch(bus)!;
    expect(retry).toEqual(first);
    fail = false;
    acknowledgeBatch(bus, receiver(retry));
    expect(got).toEqual(['newBest', 'gameOver']);
    expect(bus.journal.count).toBe(0);
  });
});
describe('preallocated memory and input', () => {
  test('pool exhaustion, slot reuse and double release protection', () => {
    const p = createPool(2),
      storage = p.free;
    expect(acquire(p)).toBe(0);
    expect(acquire(p)).toBe(1);
    expect(acquire(p)).toBe(-1);
    expect(release(p, 0)).toBe(true);
    expect(release(p, 0)).toBe(false);
    expect(release(p, 2)).toBe(false);
    expect(acquire(p)).toBe(0);
    expect(p.free).toBe(storage);
  });
  test('ring wraps without overwriting; stride remains aligned', () => {
    const r = createRing(2, 3),
      data = r.data;
    expect(pushSlot(r)).toBe(0);
    expect(pushSlot(r)).toBe(3);
    expect(pushSlot(r)).toBe(-1);
    popSlots(r);
    expect(pushSlot(r)).toBe(0);
    expect(r.data).toBe(data);
    popSlots(r, 10);
    expect(r.count).toBe(0);
  });
  test('two finger IDs remain stable, velocities and swipe/path buffers are UI owned', () => {
    const s = createInput(2);
    writeTouch(s, 42, 10, 20, 100, 0);
    writeTouch(s, 7, 100, 200, 100, 0);
    writeTouch(s, 42, 40, 20, 200, 1);
    expect(s.vx[0]).toBe(300);
    expect(s.y[1]).toBe(200);
    expect(swipeDirection(s, 0)).toBe(1);
    writeTouch(s, 42, 40, 20, 200, 2);
    expect(s.active[1]).toBe(1);
    expect(s.up).toBe(1);
    expect(appendPath(s, 0, 0, 1)).toBe(true);
    expect(appendPath(s, 1, 1, 2)).toBe(true);
    expect(appendPath(s, 2, 2, 3)).toBe(false);
    expect(s.pathOverflow).toBe(true);
    clearInput(s);
    expect(s.active[1]).toBe(0);
    expect(s.path.count).toBe(0);
  });
});
test('probe computes quantiles on preallocated scratch and counts deadlines', () => {
  const p = createProbe(100),
    storage = p.scratch;
  for (let i = 1; i <= 100; i++) sampleFrame(p, i);
  sampleFrame(p, NaN);
  summarizeProbe(p);
  expect([p.p50, p.p95, p.p99]).toEqual([50, 95, 99]);
  expect(p.missed60).toBe(84);
  expect(p.missed120).toBe(92);
  expect(p.scratch).toBe(storage);
  sampleFrame(p, 1);
  summarizeProbe(p);
  expect(p.count).toBe(100);
});
