import { ACHIEVEMENTS, coinsFor, newlyUnlocked, TOTAL_GAMES } from '../src/game/achievements';
import { MOTION_GAMES } from '../src/game/motion';
import { useAchievements } from '../src/state/achievements';
import { useArcadeProgress } from '../src/state/arcade';
import { initialProgress, useProgress } from '../src/state/progress';
import { cleanName, displayName } from '../src/state/settings';

const fresh = useAchievements.getState();
beforeEach(() => {
  useAchievements.setState({ ...fresh, unlocked: {}, toasts: [], lastDay: null });
  useProgress.setState({ ...initialProgress, coins: 0 });
});

test('achievement ids are unique and the game count matches the catalog', () => {
  expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  // Dot Runner + 3 circle games + Move & Play.
  expect(TOTAL_GAMES).toBe(4 + MOTION_GAMES.length);
});

test('first game unlocks First Dot, pays coins once and queues a toast', () => {
  const { coins, unlocked } = useAchievements.getState().reportGame({ id: 'charge', score: 10 });
  expect(coins).toBe(coinsFor('charge', 10));
  expect(unlocked.map((a) => a.id)).toEqual(['first']);
  expect(useProgress.getState().coins).toBe(coins + 50);
  expect(useAchievements.getState().toasts).toHaveLength(1);
  const again = useAchievements.getState().reportGame({ id: 'charge', score: 0 });
  expect(again.unlocked).toEqual([]);
  expect(useProgress.getState().coins).toBe(coins + 50);
});

test('event counters drive arena, duel and couple achievements', () => {
  const report = useAchievements.getState().reportGame;
  for (let i = 0; i < 3; i++) report({ id: 'duel', score: 5, duo: true });
  report({ id: 'duel', score: 5, duelWin: true });
  report({ id: 'arena', score: 400, arenaKills: 12, arenaWin: true });
  const got = Object.keys(useAchievements.getState().unlocked);
  expect(got).toEqual(expect.arrayContaining(['duelist', 'couple', 'hungry', 'champion']));
});

test('best scores and skins count, and runner pays no extra coins', () => {
  useArcadeProgress.getState().record('stack', 70);
  useProgress.setState({ best: 55, owned: Array.from({ length: 15 }, (_, i) => `s${i}`) });
  const r = useAchievements.getState().reportGame({ id: 'runner', score: 55 });
  expect(r.coins).toBe(0);
  expect(r.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['stacker', 'runner', 'fashion']));
});

test('days count once per day and newlyUnlocked skips owned achievements', () => {
  const report = useAchievements.getState().reportGame;
  report({ id: 'pulse', score: 1 });
  report({ id: 'pulse', score: 1 });
  expect(useAchievements.getState().counters.days).toBe(1);
  const stats = { ...useAchievements.getState().counters, best: {}, skinsOwned: 0 };
  expect(newlyUnlocked(stats, { first: 1 }).map((a) => a.id)).not.toContain('first');
});

test('coins are capped and ignore bad scores', () => {
  expect(coinsFor('arena', 1e9)).toBe(40);
  expect(coinsFor('pulse', NaN)).toBe(0);
  expect(coinsFor('pulse', -3)).toBe(0);
});

test('names are trimmed and capped', () => {
  expect(cleanName('   Abdullah    the   Great Dot  ')).toBe('Abdullah the');
  expect(displayName('   ')).toBe('You');
});
