export interface ClockConfig {
  step: number;
  maxDelta: number;
  maxSubsteps: number;
}
export interface Clock {
  accumulator: number;
  alpha: number;
  tick: number;
  paused: boolean;
  fresh: boolean;
  dropped: number;
  holdLatest: boolean;
}
export const DEFAULT_CLOCK: ClockConfig = { step: 1 / 120, maxDelta: 0.05, maxSubsteps: 8 };
export function createClock(): Clock {
  return { accumulator: 0, alpha: 0, tick: 0, paused: true, fresh: true, dropped: 0, holdLatest: false };
}
export function validateClock(c: ClockConfig) {
  if (
    !Number.isFinite(c.step) ||
    c.step <= 0 ||
    !Number.isFinite(c.maxDelta) ||
    c.maxDelta <= 0 ||
    !Number.isSafeInteger(c.maxSubsteps) ||
    c.maxSubsteps < 1
  )
    throw new Error('Invalid fixed clock configuration');
}
export function pauseClock(c: Clock) {
  'worklet';
  c.paused = true;
  c.accumulator = 0;
  c.alpha = 1;
  c.holdLatest = true;
  c.fresh = true;
}
export function resumeClock(c: Clock) {
  'worklet';
  c.paused = false;
  c.accumulator = 0;
  c.alpha = 1;
  c.holdLatest = true;
  c.fresh = true;
}
export function resetClock(c: Clock) {
  'worklet';
  pauseClock(c);
  c.alpha = 0;
  c.holdLatest = false;
  c.tick = 0;
  c.dropped = 0;
}
/** Plans bounded fixed ticks; caller advances tick only after a successful engine step. */
export function planFrame(c: Clock, rawDelta: number, config: ClockConfig): number {
  'worklet';
  if (c.paused) return 0;
  if (c.fresh) {
    c.fresh = false;
    return 0;
  }
  if (!Number.isFinite(rawDelta) || rawDelta <= 0) return 0;
  const delta = Math.min(rawDelta, config.maxDelta);
  c.dropped += rawDelta - delta;
  c.accumulator += delta;
  const available = Math.floor((c.accumulator + config.step * 1e-9) / config.step);
  const count = Math.min(available, config.maxSubsteps);
  c.accumulator -= count * config.step;
  if (available > count) {
    const discarded = (available - count) * config.step;
    c.accumulator -= discarded;
    c.dropped += discarded;
  }
  c.accumulator = Math.max(0, c.accumulator);
  if (count > 0) c.holdLatest = false;
  c.alpha = c.holdLatest ? 1 : Math.min(c.accumulator / config.step, 1);
  return count;
}
