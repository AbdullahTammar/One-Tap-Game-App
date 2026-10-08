export interface Pool {
  free: Int32Array;
  active: Uint8Array;
  count: number;
  capacity: number;
}
export function createPool(capacity: number): Pool {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid pool capacity');
  const free = new Int32Array(capacity);
  for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i;
  return { free, active: new Uint8Array(capacity), count: 0, capacity };
}
export function acquire(p: Pool): number {
  'worklet';
  if (p.count === p.capacity) return -1;
  const slot = p.free[p.capacity - 1 - p.count];
  p.active[slot] = 1;
  p.count++;
  return slot;
}
export function release(p: Pool, slot: number): boolean {
  'worklet';
  if (slot < 0 || slot >= p.capacity || !Number.isInteger(slot) || !p.active[slot]) return false;
  p.active[slot] = 0;
  p.count--;
  p.free[p.capacity - 1 - p.count] = slot;
  return true;
}
export interface Ring {
  data: Float64Array;
  head: number;
  count: number;
  capacity: number;
  stride: number;
}
export function createRing(capacity: number, stride = 1): Ring {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isSafeInteger(stride) || stride < 1)
    throw new Error('Invalid ring capacity/stride');
  return { data: new Float64Array(capacity * stride), head: 0, count: 0, capacity, stride };
}
/** Reserve a slot; full buffers return -1 rather than overwriting unconsumed data. */
export function pushSlot(r: Ring): number {
  'worklet';
  if (r.count === r.capacity) return -1;
  const offset = ((r.head + r.count) % r.capacity) * r.stride;
  r.count++;
  return offset;
}
export function popSlots(r: Ring, count = 1) {
  'worklet';
  const n = Math.min(r.count, Math.max(0, Math.floor(count)));
  r.head = (r.head + n) % r.capacity;
  r.count -= n;
}
