import { angleDistance, createArcade, roundDuration, stepArcade, tapArcade, type ArcadeId } from '../src/game/arcade';

describe('circle collection rules', () => {
  test.each<ArcadeId>(['pulse', 'switch', 'lock'])('%s starts without counting the starting tap', (id) => {
    expect(tapArcade(createArcade(), id)).toMatchObject({ phase: 'running', score: 0, lane: 0 });
  });
  test('pulse rewards alignment and resets the next ring', () => {
    const running = tapArcade(createArcade(), 'pulse');
    const aligned = stepArcade(running, 'pulse', (138 - 76) / 38);
    expect(tapArcade(aligned, 'pulse')).toMatchObject({ score: 1, radius: 138, elapsed: 0, perfect: true });
    expect(tapArcade(running, 'pulse').phase).toBe('over');
    expect(stepArcade(running, 'pulse', 3).phase).toBe('over');
  });
  test('pulse accepts both boundaries of the visible timing window', () => {
    for (const radius of [64, 88])
      expect(tapArcade({ ...createArcade(), phase: 'running', radius }, 'pulse').score).toBe(1);
  });
  test('dot lock accepts target, rejects early taps, and ends on a missed target', () => {
    const running = tapArcade(createArcade(), 'lock');
    expect(tapArcade({ ...running, angle: running.target }, 'lock')).toMatchObject({
      score: 1,
      perfect: true,
      elapsed: 0,
    });
    expect(tapArcade(running, 'lock').phase).toBe('over');
    expect(stepArcade(running, 'lock', 3).phase).toBe('over');
    expect(angleDistance(0.1, Math.PI * 2 + 0.1)).toBeCloseTo(0);
  });
  test('switch requires moving away from the incoming dot', () => {
    const running = tapArcade(createArcade(), 'switch');
    expect(stepArcade(running, 'switch', roundDuration(0)).phase).toBe('over');
    const safe = tapArcade(running, 'switch');
    expect(stepArcade(safe, 'switch', roundDuration(0))).toMatchObject({ phase: 'running', score: 1, elapsed: 0 });
  });
  test('collision is detected before the center crossing, even across a slow frame', () => {
    const running = tapArcade(createArcade(), 'switch');
    expect(stepArcade(running, 'switch', roundDuration(0) * 0.96).phase).toBe('over');
    expect(tapArcade(stepArcade(running, 'switch', 3), 'switch').phase).toBe('over');
  });
  test.each<ArcadeId>(['pulse', 'switch', 'lock'])('%s freezes when paused and resumes without resetting', (id) => {
    const paused = { ...createArcade(), phase: 'paused' as const, score: 5, elapsed: 0.3 };
    expect(stepArcade(paused, id, 10)).toBe(paused);
    expect(tapArcade(paused, id)).toMatchObject({ phase: 'running', score: 5, elapsed: 0.3 });
    const over = { ...paused, phase: 'over' as const };
    expect(tapArcade(over, id)).toBe(over);
    expect(stepArcade(over, id, 1)).toBe(over);
  });
  test('rejects invalid frame deltas and caps difficulty', () => {
    const running = tapArcade(createArcade(), 'pulse');
    for (const dt of [NaN, Infinity, -1, 0]) expect(stepArcade(running, 'pulse', dt)).toBe(running);
    expect(roundDuration(10000)).toBe(0.9);
  });
  test.each<ArcadeId>(['pulse', 'lock'])('%s remains playable through 100 rounds at increasing difficulty', (id) => {
    let s = tapArcade(createArcade(), id);
    for (let round = 0; round < 100; round++) {
      const dt =
        id === 'pulse'
          ? (138 - 76) / (38 + Math.min(s.score, 40) * 1.6)
          : (s.target + Math.PI / 2) / (1.5 + Math.min(s.score, 40) * 0.07);
      s = tapArcade(stepArcade(s, id, dt), id);
      expect(s.phase).toBe('running');
      expect(s.score).toBe(round + 1);
    }
  });
});
