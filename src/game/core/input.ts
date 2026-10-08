import { createRing, pushSlot, type Ring } from './memory';
export const TOUCH_CAPACITY = 10;
export interface InputState {
  ids: Int32Array;
  active: Uint8Array;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  time: Float64Array;
  startX: Float64Array;
  startY: Float64Array;
  down: number;
  up: number;
  cancelled: boolean;
  flingX: number;
  flingY: number;
  path: Ring;
  pathOverflow: boolean;
}
export function createInput(pathCapacity = 512): InputState {
  return {
    ids: new Int32Array(TOUCH_CAPACITY).fill(-1),
    active: new Uint8Array(TOUCH_CAPACITY),
    x: new Float64Array(TOUCH_CAPACITY),
    y: new Float64Array(TOUCH_CAPACITY),
    vx: new Float64Array(TOUCH_CAPACITY),
    vy: new Float64Array(TOUCH_CAPACITY),
    time: new Float64Array(TOUCH_CAPACITY),
    startX: new Float64Array(TOUCH_CAPACITY),
    startY: new Float64Array(TOUCH_CAPACITY),
    down: 0,
    up: 0,
    cancelled: false,
    flingX: 0,
    flingY: 0,
    path: createRing(pathCapacity, 3),
    pathOverflow: false,
  };
}
export function clearInput(s: InputState) {
  'worklet';
  s.active.fill(0);
  s.ids.fill(-1);
  s.down = 0;
  s.up = 0;
  s.cancelled = false;
  s.vx.fill(0);
  s.vy.fill(0);
  s.flingX = 0;
  s.flingY = 0;
  s.path.head = 0;
  s.path.count = 0;
  s.pathOverflow = false;
}
/** Stable finger IDs, position and sampled velocity; down/up are latches consumed by a fixed tick. */
export function writeTouch(s: InputState, id: number, x: number, y: number, ms: number, phase: 0 | 1 | 2) {
  'worklet';
  let slot = -1;
  for (let i = 0; i < TOUCH_CAPACITY; i++)
    if (s.ids[i] === id && s.active[i]) {
      slot = i;
      break;
    }
  if (slot < 0 && phase !== 0) return;
  if (slot < 0)
    for (let i = 0; i < TOUCH_CAPACITY; i++)
      if (!s.active[i]) {
        slot = i;
        break;
      }
  if (slot < 0) return;
  if (phase === 0) {
    s.ids[slot] = id;
    s.active[slot] = 1;
    s.startX[slot] = x;
    s.startY[slot] = y;
    s.vx[slot] = 0;
    s.vy[slot] = 0;
    s.down |= 1 << slot;
  } else {
    const dt = (ms - s.time[slot]) / 1000;
    if (dt > 0) {
      s.vx[slot] = (x - s.x[slot]) / dt;
      s.vy[slot] = (y - s.y[slot]) / dt;
    }
  }
  s.x[slot] = x;
  s.y[slot] = y;
  s.time[slot] = ms;
  if (phase === 2) {
    s.active[slot] = 0;
    s.up |= 1 << slot;
    s.flingX = s.vx[slot];
    s.flingY = s.vy[slot];
  }
}
export function appendPath(s: InputState, x: number, y: number, tick: number): boolean {
  'worklet';
  const o = pushSlot(s.path);
  if (o < 0) {
    s.pathOverflow = true;
    return false;
  }
  s.path.data[o] = x;
  s.path.data[o + 1] = y;
  s.path.data[o + 2] = tick;
  return true;
}
export function swipeDirection(s: InputState, slot: number, threshold = 22): number {
  'worklet';
  const dx = s.x[slot] - s.startX[slot],
    dy = s.y[slot] - s.startY[slot];
  if (Math.hypot(dx, dy) < threshold) return -1;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
