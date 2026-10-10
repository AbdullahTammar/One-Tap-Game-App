// One-time capture from the unmodified legacy engine. Never regenerate to make a parity failure pass.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const crypto = require('crypto');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { createArena, stepArena, inputArena } = require('../src/game/motion/arena.ts');
function numeric(s) {
  return [s.seed, s.phase, s.elapsed, s.zone, s.peak, s.score, s.kills, s.rank, s.nextId,
    s.orbs.map(o => [o.id, o.x, o.y, o.mass, o.vx, o.vy, o.dashCd, o.dashT, o.shield, o.magnet, o.alive, o.think, o.hx, o.hy]),
    s.pellets.map(p => [p.x, p.y, p.color]), s.powers.map(p => [p.x, p.y, p.kind])];
}
function setup(name, seed) {
  const s = createArena(seed, 'Trace'); s.phase = 'running';
  if (name !== 'scripted') {
    const me = s.orbs[0]; me.mass = name === 'match' ? 2000 : 100; me.shield = name === 'match' ? 1000 : 0;
    if (name === 'powers') s.powers = ['shield', 'magnet', 'surge'].map(kind => ({ x: me.x, y: me.y, kind }));
    if (name === 'kill-respawn') { s.orbs[1].x = me.x; s.orbs[1].y = me.y; s.orbs[1].mass = 5; s.orbs[1].shield = 0; }
  }
  return s;
}
function commands(name, i) {
  if (name === 'match') return [];
  const result = [];
  if (i % 120 === 0) result.push({ type: 'down', x: 100, y: 100 });
  if (i % 120 === 1) result.push({ type: 'move', x: 140 + (i % 240 ? 0 : -80), y: 100 });
  if (i % 300 === 2) result.push({ type: 'action' });
  if (i % 120 === 90) result.push({ type: 'up', x: 100, y: 100 });
  return result;
}
const cases = [];
for (const dt of [1 / 60, 1 / 120]) for (const name of ['scripted', 'powers', 'kill-respawn', 'match']) {
  let s = setup(name, 42); const checkpoints = [];
  for (let i = 0; i < Math.ceil(181 / dt) && s.phase === 'running'; i++) {
    for (const command of commands(name, i)) s = inputArena(s, command);
    s = stepArena(s, dt);
    if (i % Math.round(5 / dt) === 0 || s.phase === 'over') checkpoints.push({ tick: i,
      hash: crypto.createHash('sha256').update(JSON.stringify(numeric(s))).digest('hex'),
      score: s.score, kills: s.kills, rank: s.rank, elapsed: s.elapsed, seed: s.seed, nextId: s.nextId });
  }
  cases.push({ name, seed: 42, dt, checkpoints });
}
fs.mkdirSync(path.join(__dirname, '../__tests__/fixtures'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../__tests__/fixtures/arena-legacy.json'), JSON.stringify(cases, null, 2) + '\n');
