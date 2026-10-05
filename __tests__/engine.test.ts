import { GAME } from '../src/game/constants';
import {
  canContinue,
  continueRun,
  createGame,
  gateHalf,
  levelFor,
  nextRandom,
  pause,
  step,
  tap,
  wrapAngle,
  type GameState,
} from '../src/game/engine';

const running = (over: Partial<GameState> = {}): GameState => ({
  ...createGame(GAME.startSpeed, 42),
  phase: 'running',
  ...over,
});

describe('helpers', () => {
  it('wraps angles into (-PI, PI]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });

  it('shrinks the gate with score down to a floor', () => {
    expect(gateHalf(0)).toBeCloseTo(GAME.gateHalfStart);
    expect(gateHalf(10)).toBeCloseTo(GAME.gateHalfStart - 10 * GAME.gateHalfShrink);
    expect(gateHalf(10_000)).toBe(GAME.gateHalfMin);
  });

  it('levels up every 5 gates', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(4)).toBe(1);
    expect(levelFor(5)).toBe(2);
    expect(levelFor(42)).toBe(9);
  });

  it('PRNG is deterministic and in [0,1)', () => {
    let seed = 7;
    const seen: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextRandom(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.push(v);
      seed = next;
    }
    expect(nextRandom(7)[0]).toBe(seen[0]);
    expect(new Set(seen).size).toBeGreaterThan(990);
  });
});

describe('tap', () => {
  it('first tap starts the run', () => {
    const r = tap(createGame());
    expect(r.state.phase).toBe('running');
    expect(r.event).toEqual({ type: 'start' });
  });

  it('a tap inside the gate scores, flips direction, speeds up and moves the gate', () => {
    const s = running({ angle: 1, gate: 1 });
    const r = tap(s);
    expect(r.event).toMatchObject({ type: 'hit', perfect: true, score: 1 });
    expect(r.state.score).toBe(1);
    expect(r.state.dir).toBe(-1);
    expect(r.state.speed).toBeCloseTo(GAME.startSpeed * GAME.speedGrowth);
    const gap = Math.abs(wrapAngle(r.state.gate - s.angle));
    expect(gap).toBeGreaterThanOrEqual(
      Math.min(GAME.nextGateMin, 2 * Math.PI - GAME.nextGateMin - GAME.nextGateRange) - 1e-9,
    );
    expect(r.state.inside).toBe(false);
  });

  it('a hit at the gate edge is not perfect but still counts', () => {
    const half = gateHalf(0);
    const r = tap(running({ angle: 1 + half + GAME.tapTolerance * 0.5, gate: 1 }));
    expect(r.event).toMatchObject({ type: 'hit', perfect: false });
  });

  it('an early tap ends the run', () => {
    const r = tap(running({ angle: 0, gate: 1.5, dir: 1 }));
    expect(r.state.phase).toBe('over');
    expect(r.event).toMatchObject({ type: 'miss', reason: 'early' });
  });

  it('tracks perfect combos', () => {
    let s = running({ angle: 1, gate: 1 });
    s = tap(s).state;
    s = tap({ ...s, angle: s.gate }).state;
    expect(s.combo).toBe(2);
    expect(s.bestCombo).toBe(2);
    const half = gateHalf(s.score);
    s = tap({ ...s, angle: s.gate + half }).state;
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
  });

  it('speed is capped', () => {
    const r = tap(running({ angle: 1, gate: 1, speed: GAME.maxSpeed }));
    expect(r.state.speed).toBe(GAME.maxSpeed);
  });

  it('ignores taps once the run is over', () => {
    const s = running({ phase: 'over' });
    expect(tap(s)).toEqual({ state: s, event: null });
  });
});

describe('step', () => {
  it('does nothing unless running', () => {
    const s = createGame();
    expect(step(s, 0.016).state).toBe(s);
  });

  it('moves the orb at speed * dt', () => {
    const s = running({ angle: 0, gate: 3 });
    const r = step(s, 0.016);
    expect(r.state.angle).toBeCloseTo(GAME.startSpeed * 0.016);
  });

  it('clamps huge frame deltas (app resume)', () => {
    const s = running({ angle: 0, gate: 3 });
    expect(step(s, 5).state.angle).toBeCloseTo(GAME.startSpeed * GAME.maxFrameDelta);
  });

  it('ends the run when the orb slips past the gate', () => {
    let s = running();
    let event = null;
    for (let i = 0; i < 600 && !event; i++) ({ state: s, event } = step(s, 1 / 60));
    expect(event).toMatchObject({ type: 'miss', reason: 'slip' });
    expect(s.phase).toBe('over');
  });

  it('never tunnels through the narrowest gate at max speed', () => {
    const half = GAME.gateHalfMin;
    let s = running({ speed: GAME.maxSpeed, score: 1000, angle: 0, gate: 1 });
    let inside = false;
    for (let i = 0; i < 20; i++) {
      s = step(s, GAME.maxFrameDelta).state;
      if (Math.abs(wrapAngle(s.angle - s.gate)) <= half) inside = true;
      if (s.inside) break;
    }
    expect(s.inside || inside).toBe(true);
  });

  it('a perfect bot survives 200 gates', () => {
    let s = tap(createGame(GAME.startSpeed, 99)).state;
    for (let frame = 0; frame < 200_000 && s.score < 200; frame++) {
      s = step(s, 1 / 120).state;
      expect(s.phase).toBe('running');
      if (Math.abs(wrapAngle(s.angle - s.gate)) <= gateHalf(s.score) * 0.3) s = tap(s).state;
    }
    expect(s.score).toBe(200);
  });
});

describe('pause / continue', () => {
  it('pauses and resumes', () => {
    const p = pause(running());
    expect(p.phase).toBe('paused');
    expect(step(p, 0.1).state).toBe(p);
    expect(tap(p).event).toEqual({ type: 'resume' });
  });

  it('allows exactly one continue per run, keeping the score', () => {
    const over = running({ phase: 'over', score: 12, speed: 4 });
    expect(canContinue(over)).toBe(true);
    const c = continueRun(over);
    expect(c.phase).toBe('ready');
    expect(c.score).toBe(12);
    expect(c.speed).toBeCloseTo(3.6);
    expect(c.continues).toBe(1);
    expect(tap(c).event).toEqual({ type: 'resume' });
    const over2 = { ...c, phase: 'over' as const };
    expect(canContinue(over2)).toBe(false);
    expect(continueRun(over2)).toBe(over2);
  });
});
