import { createRing, popSlots, pushSlot, type Ring } from './memory';
export enum EventKind {
  score = 1,
  combo,
  hit,
  newBest,
  achievementUnlocked,
  gameOver,
}
export type DiscreteEvent =
  | { type: 'score' | 'combo' | 'newBest'; value: number }
  | { type: 'hit'; value: number; perfect: boolean }
  | { type: 'achievementUnlocked'; id: number }
  | { type: 'gameOver'; score: number; reason: number };
// Wire layout: sequence, session, kind, a, b. No game state crosses runtimes.
export const EVENT_STRIDE = 5;
export interface EventBus {
  journal: Ring;
  sequence: number;
  session: number;
  terminal: boolean;
  inFlight: number;
  retry: boolean;
  best: number;
  achievements: Uint8Array;
}
export function createEventBus(capacity = 256, session = 1): EventBus {
  return {
    journal: createRing(capacity, EVENT_STRIDE),
    sequence: 0,
    session,
    terminal: false,
    inFlight: 0,
    retry: false,
    best: -Infinity,
    achievements: new Uint8Array(256),
  };
}
export function beginSession(bus: EventBus) {
  'worklet';
  // Retain all pending events from previous sessions, including persistence.
  bus.session++;
  bus.terminal = false;
  bus.best = -Infinity;
  bus.achievements.fill(0);
}
export function hasEventRoom(bus: EventBus, budget: number) {
  'worklet';
  return bus.journal.capacity - bus.journal.count >= budget;
}
/** Engine must declare/reserve its maximum emissions per tick. False means retry without committing state. */
export function emitEvent(bus: EventBus, kind: EventKind, a = 0, b = 0): boolean {
  'worklet';
  if (bus.terminal) return true;
  if (kind === EventKind.newBest && a <= bus.best) return true;
  if (kind === EventKind.achievementUnlocked) {
    if (!Number.isInteger(a) || a < 0 || a >= bus.achievements.length) return false;
    if (bus.achievements[a]) return true;
  }
  const r = bus.journal;
  // Only coalesce unsent display updates. Persistence and hits remain ordered journal entries.
  if (kind === EventKind.score || kind === EventKind.combo) {
    for (let i = r.count - 1; i >= bus.inFlight; i--) {
      const o = ((r.head + i) % r.capacity) * r.stride;
      if (r.data[o + 1] !== bus.session) break;
      if (r.data[o + 2] === kind) {
        r.data[o + 3] = a;
        r.data[o + 4] = b;
        return true;
      }
    }
  }
  const o = pushSlot(r);
  if (o < 0) return false;
  r.data[o] = ++bus.sequence;
  r.data[o + 1] = bus.session;
  r.data[o + 2] = kind;
  r.data[o + 3] = a;
  r.data[o + 4] = b;
  if (kind === EventKind.newBest) bus.best = a;
  if (kind === EventKind.achievementUnlocked) bus.achievements[a] = 1;
  if (kind === EventKind.gameOver) bus.terminal = true;
  return true;
}
/** Discrete-event transport allocation only. Caller schedules once per nonempty batch, never per empty frame. */
export function takeBatch(bus: EventBus, limit = 32): number[] | null {
  'worklet';
  if ((bus.inFlight && !bus.retry) || !bus.journal.count) return null;
  const r = bus.journal,
    count = bus.inFlight || Math.min(limit, r.count);
  const batch = new Array<number>(count * EVENT_STRIDE);
  for (let i = 0; i < count; i++) {
    const offset = ((r.head + i) % r.capacity) * r.stride;
    for (let j = 0; j < EVENT_STRIDE; j++) batch[i * EVENT_STRIDE + j] = r.data[offset + j];
  }
  bus.inFlight = count;
  bus.retry = false;
  return batch;
}
export function acknowledgeBatch(bus: EventBus, lastSequence: number) {
  'worklet';
  const r = bus.journal;
  if (!bus.inFlight) return;
  const last = ((r.head + bus.inFlight - 1) % r.capacity) * r.stride;
  if (r.data[last] !== lastSequence) return;
  popSlots(r, bus.inFlight);
  bus.inFlight = 0;
}
export function decodeEvent(kind: EventKind, a: number, b: number): DiscreteEvent {
  switch (kind) {
    case EventKind.score:
      return { type: 'score', value: a };
    case EventKind.combo:
      return { type: 'combo', value: a };
    case EventKind.hit:
      return { type: 'hit', value: a, perfect: b === 1 };
    case EventKind.newBest:
      return { type: 'newBest', value: a };
    case EventKind.achievementUnlocked:
      return { type: 'achievementUnlocked', id: a };
    case EventKind.gameOver:
      return { type: 'gameOver', score: a, reason: b };
    default:
      throw new Error('Unknown event kind');
  }
}
/** RN-side duplicate suppression. Handler must complete synchronously; durable effects should use the idempotency key. */
export function createEventReceiver(handler: (event: DiscreteEvent, session: number, sequence: number) => void) {
  let delivered = 0;
  return (batch: readonly number[]) => {
    for (let o = 0; o < batch.length; o += EVENT_STRIDE) {
      const sequence = batch[o];
      if (sequence <= delivered) continue;
      handler(decodeEvent(batch[o + 2], batch[o + 3], batch[o + 4]), batch[o + 1], sequence);
      delivered = sequence;
    }
    return batch[batch.length - EVENT_STRIDE];
  };
}
