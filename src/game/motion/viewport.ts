/** Screen coordinates to the existing square simulation; Link uses the full rectangle. */
export function motionPoint(x: number, y: number, width: number, height: number, rectangular: boolean) {
  return { x: (x * 320) / Math.max(1, width), y: (y * 320) / Math.max(1, rectangular ? height : width) };
}

/** Paint follows the player while filling the stage, without stretching cells. */
export function paintCamera(x: number, y: number, height: number) {
  const zoom = Math.max(1, height / 320);
  const halfWidth = 160 / zoom;
  const halfHeight = height / (2 * zoom);
  const cx = Math.max(halfWidth, Math.min(320 - halfWidth, x));
  const cy = Math.max(halfHeight, Math.min(320 - halfHeight, y));
  return { zoom, x: 160 - cx * zoom, y: height / 2 - cy * zoom };
}
