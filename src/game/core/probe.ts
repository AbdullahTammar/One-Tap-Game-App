export interface Probe {
  samples: Float64Array;
  scratch: Float64Array;
  cursor: number;
  count: number;
  frames: number;
  missed60: number;
  missed120: number;
  p50: number;
  p95: number;
  p99: number;
}
export function createProbe(capacity = 600): Probe {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid probe capacity');
  return {
    samples: new Float64Array(capacity),
    scratch: new Float64Array(capacity),
    cursor: 0,
    count: 0,
    frames: 0,
    missed60: 0,
    missed120: 0,
    p50: 0,
    p95: 0,
    p99: 0,
  };
}
export function sampleFrame(p: Probe, ms: number) {
  'worklet';
  if (!Number.isFinite(ms) || ms <= 0) return;
  p.samples[p.cursor] = ms;
  p.cursor = (p.cursor + 1) % p.samples.length;
  p.count = Math.min(p.count + 1, p.samples.length);
  p.frames++;
  if (ms > 1000 / 60) p.missed60++;
  if (ms > 1000 / 120) p.missed120++;
}
function sift(a: Float64Array, root: number, size: number) {
  'worklet';
  while (root * 2 + 1 < size) {
    let child = root * 2 + 1;
    if (child + 1 < size && a[child] < a[child + 1]) child++;
    if (a[root] >= a[child]) return;
    const v = a[root];
    a[root] = a[child];
    a[child] = v;
    root = child;
  }
}
/** In-place heapsort of preallocated scratch, on demand (not every frame). */
export function summarizeProbe(p: Probe) {
  'worklet';
  const n = p.count,
    a = p.scratch;
  for (let i = 0; i < n; i++) a[i] = p.samples[i];
  for (let start = Math.floor(n / 2) - 1; start >= 0; start--) sift(a, start, n);
  for (let end = n - 1; end > 0; end--) {
    const v = a[0];
    a[0] = a[end];
    a[end] = v;
    sift(a, 0, end);
  }
  if (!n) {
    p.p50 = 0;
    p.p95 = 0;
    p.p99 = 0;
    return;
  }
  p.p50 = a[Math.ceil(n * 0.5) - 1];
  p.p95 = a[Math.ceil(n * 0.95) - 1];
  p.p99 = a[Math.ceil(n * 0.99) - 1];
}
