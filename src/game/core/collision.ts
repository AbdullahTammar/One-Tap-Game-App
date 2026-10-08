/** Time of impact in [0,1]; Infinity means no hit. Inputs are linear displacements, not velocities. */
export function sweepCircles(
  ax: number,
  ay: number,
  adx: number,
  ady: number,
  ar: number,
  bx: number,
  by: number,
  bdx: number,
  bdy: number,
  br: number,
): number {
  'worklet';
  const x = ax - bx,
    y = ay - by,
    dx = adx - bdx,
    dy = ady - bdy,
    r = ar + br;
  const c = x * x + y * y - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy,
    b = x * dx + y * dy;
  if (a <= 1e-18 || b >= 0) return Infinity;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}
/** Exact capsule sweep: segment sides plus round endpoints, including degenerate segments. */
export function sweepSegment(
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  'worklet';
  const sx = bx - ax,
    sy = by - ay,
    length = Math.hypot(sx, sy);
  if (length < 1e-9) return sweepCircles(x, y, dx, dy, r, ax, ay, 0, 0, 0);
  const ux = sx / length,
    uy = sy / length;
  const along = (x - ax) * ux + (y - ay) * uy;
  const normal = -(x - ax) * uy + (y - ay) * ux;
  if (along >= 0 && along <= length && Math.abs(normal) <= r) return 0;
  let best = Math.min(sweepCircles(x, y, dx, dy, r, ax, ay, 0, 0, 0), sweepCircles(x, y, dx, dy, r, bx, by, 0, 0, 0));
  const vn = -dx * uy + dy * ux,
    va = dx * ux + dy * uy;
  if (Math.abs(vn) > 1e-12) {
    for (let side = -1; side <= 1; side += 2) {
      const t = (side * r - normal) / vn,
        hitAlong = along + va * t;
      if (t >= 0 && t <= 1 && hitAlong >= 0 && hitAlong <= length) best = Math.min(best, t);
    }
  }
  return best;
}
/** Exact rounded-box sweep; avoids the false corner hits of an expanded rectangular slab. */
export function sweepAABB(
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  'worklet';
  if (x >= minX && x <= maxX && y >= minY && y <= maxY) return 0;
  return Math.min(
    sweepSegment(x, y, dx, dy, r, minX, minY, maxX, minY),
    sweepSegment(x, y, dx, dy, r, maxX, minY, maxX, maxY),
    sweepSegment(x, y, dx, dy, r, maxX, maxY, minX, maxY),
    sweepSegment(x, y, dx, dy, r, minX, maxY, minX, minY),
  );
}
