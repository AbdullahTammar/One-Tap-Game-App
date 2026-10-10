import { motionPoint, paintCamera } from '../src/game/motion/viewport';
import { cellCenter, createFlow, inputFlow, stepFlow, FLOW_CLEAR_TIME } from '../src/game/motion/flow';

test('Link touch coordinates match full-height dots on portrait and landscape stages', () => {
  for (const [width, height] of [
    [400, 800],
    [800, 400],
  ]) {
    for (let i = 0; i < 36; i++) {
      const p = cellCenter(i);
      const mapped = motionPoint((p.x * width) / 320, (p.y * height) / 320, width, height, true);
      const s = createFlow(42);
      s.phase = 'running';
      expect(inputFlow(s, { type: 'down', ...mapped }).path).toEqual([i]);
    }
  }
});

test('Paint camera fills the stage with square cells and keeps player visible at edges', () => {
  for (const height of [240, 320, 600, 900]) {
    for (const x of [5, 165, 315]) {
      const camera = paintCamera(x, 165, height);
      expect(x * camera.zoom + camera.x).toBeGreaterThanOrEqual(0);
      expect(x * camera.zoom + camera.x).toBeLessThanOrEqual(320);
      expect(camera.zoom * 320).toBeGreaterThanOrEqual(height);
    }
  }
});

test('Link clear creates bounded animation, expires it, and freezes it while paused', () => {
  let s = createFlow(42);
  s.phase = 'running';
  s.grid[0] = s.grid[1] = 0;
  s = inputFlow(s, { type: 'down', ...cellCenter(0) });
  s = inputFlow(s, { type: 'move', ...cellCenter(1) });
  s = inputFlow(s, { type: 'up', ...cellCenter(1) });
  expect(s.score).toBe(2);
  expect(s.burst).toEqual([0, 1]);
  expect(s.burstLeft).toBe(FLOW_CLEAR_TIME);
  expect(s.burstLeft).toBeLessThanOrEqual(0.15);
  const paused = { ...s, phase: 'paused' as const };
  expect(stepFlow(paused, 0.05)).toBe(paused);
  for (let i = 0; i < 3; i++) s = stepFlow(s, 0.05);
  expect(s.burstLeft).toBe(0);
  expect(s.burst).toEqual([]);
});

test('fast Link swipes include intermediate matching dots and final lift segment', () => {
  let s = createFlow(42);
  s.phase = 'running';
  s.grid.fill(0);
  s = inputFlow(s, { type: 'down', ...cellCenter(0) });
  s = inputFlow(s, { type: 'move', ...cellCenter(4) });
  expect(s.path).toEqual([0, 1, 2, 3, 4]);
  s = inputFlow(s, { type: 'up', ...cellCenter(5) });
  expect(s.score).toBe(6);
  expect(s.pointer).toBeNull();
});

test('fast swipes cannot jump over a different color and backtracking still works', () => {
  let s = createFlow(42);
  s.phase = 'running';
  s.grid.fill(0);
  s.grid[2] = 1;
  s = inputFlow(s, { type: 'down', ...cellCenter(0) });
  s = inputFlow(s, { type: 'move', ...cellCenter(4) });
  expect(s.path).toEqual([0, 1]);
  s = inputFlow(s, { type: 'move', ...cellCenter(0) });
  expect(s.path).toEqual([0]);
});
