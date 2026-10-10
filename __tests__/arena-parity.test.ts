import { createHash } from 'crypto';
import traces from './fixtures/arena-legacy.json';
import { createArena, stepArena, inputArena, type ArenaState } from '../src/game/motion/arena';
import {
  createArenaBuffers,
  stepArenaBuffers,
  arenaInput,
  F,
  orb,
  put,
  type ArenaBuffers,
} from '../src/game/arena/engine';

function legacyNumeric(s: ArenaState) {
  return [
    s.seed,
    s.phase,
    s.elapsed,
    s.zone,
    s.peak,
    s.score,
    s.kills,
    s.rank,
    s.nextId,
    s.orbs.map((o) => [
      o.id,
      o.x,
      o.y,
      o.mass,
      o.vx,
      o.vy,
      o.dashCd,
      o.dashT,
      o.shield,
      o.magnet,
      o.alive,
      o.think,
      o.hx,
      o.hy,
    ]),
    s.pellets.map((p) => [p.x, p.y, p.color]),
    s.powers.map((p) => [p.x, p.y, p.kind]),
  ];
}
function bufferNumeric(s: ArenaBuffers) {
  const orbs = Array.from(s.order.subarray(0, s.count), (slot) =>
    [F.id, F.x, F.y, F.mass, F.vx, F.vy, F.dashCd, F.dashT, F.shield, F.magnet, F.alive, F.think, F.hx, F.hy].map(
      (f) => (f === F.alive ? !!orb(s, f, slot) : orb(s, f, slot)),
    ),
  );
  return [
    s.seed,
    s.over ? 'over' : 'running',
    s.elapsed,
    s.zone,
    s.peak,
    s.score,
    s.kills,
    s.rank,
    s.nextId,
    orbs,
    Array.from({ length: s.pelletCount }, (_, i) => [s.pelletX[i], s.pelletY[i], s.pelletColor[i]]),
    Array.from({ length: s.powerCount }, (_, i) => [
      s.powerX[i],
      s.powerY[i],
      ['shield', 'magnet', 'surge'][s.powerKind[i]],
    ]),
  ];
}
const hash = (s: unknown) => createHash('sha256').update(JSON.stringify(s)).digest('hex');
test.each(traces)('frozen $name trace at dt=$dt matches both legacy and preallocated engine exactly', (trace) => {
  let old = createArena(trace.seed, 'Trace');
  old.phase = 'running';
  const next = createArenaBuffers(trace.seed);
  if (trace.name !== 'scripted') {
    const mass = trace.name === 'match' ? 2000 : 100,
      shield = trace.name === 'match' ? 1000 : 0;
    old.orbs[0].mass = mass;
    old.orbs[0].shield = shield;
    put(next, F.mass, 0, mass);
    put(next, F.shield, 0, shield);
    if (trace.name === 'powers') {
      old.powers = [
        { x: 700, y: 700, kind: 'shield' },
        { x: 700, y: 700, kind: 'magnet' },
        { x: 700, y: 700, kind: 'surge' },
      ];
      next.powerCount = 3;
      for (let p = 0; p < 3; p++) {
        next.powerX[p] = 700;
        next.powerY[p] = 700;
        next.powerKind[p] = p;
      }
    }
    if (trace.name === 'kill-respawn') {
      Object.assign(old.orbs[1], { x: 700, y: 700, mass: 5, shield: 0 });
      put(next, F.x, 1, 700);
      put(next, F.y, 1, 700);
      put(next, F.mass, 1, 5);
      put(next, F.shield, 1, 0);
    }
  }
  let checkpoint = 0;
  const last = trace.checkpoints[trace.checkpoints.length - 1].tick;
  for (let i = 0; i <= last; i++) {
    if (trace.name !== 'match') {
      if (i % 120 === 0) {
        old = inputArena(old, { type: 'down', x: 100, y: 100 });
        arenaInput(next, 'down', 100, 100);
      }
      if (i % 120 === 1) {
        const x = 140 + (i % 240 ? 0 : -80);
        old = inputArena(old, { type: 'move', x, y: 100 });
        arenaInput(next, 'move', x, 100);
      }
      if (i % 300 === 2) {
        old = inputArena(old, { type: 'action' });
        arenaInput(next, 'action');
      }
      if (i % 120 === 90) {
        old = inputArena(old, { type: 'up', x: 100, y: 100 });
        arenaInput(next, 'up', 100, 100);
      }
    }
    old = stepArena(old, trace.dt);
    stepArenaBuffers(next, trace.dt);
    if (i === trace.checkpoints[checkpoint]?.tick) {
      const expected = trace.checkpoints[checkpoint++];
      expect(hash(legacyNumeric(old))).toBe(expected.hash);
      expect(hash(bufferNumeric(next))).toBe(expected.hash);
    }
  }
});
