import { mmkv } from '../src/state/storage';
import { useProgress, initialProgress } from '../src/state/progress';
import { useAchievements } from '../src/state/achievements';
import { useArcadeProgress } from '../src/state/arcade';
import { persistArenaEvent, handoffArenaRun, drainArenaOutbox, reserveArenaRun, useArenaQueue } from '../src/services/arenaPersistence';
const initial = useAchievements.getState();
beforeEach(() => {
  mmkv.clearAll(); useProgress.setState({ ...initialProgress, coins: 0, arenaReceipts: {} });
  useAchievements.setState({ ...initial, arenaOutcomes: {}, unlocked: {}, toasts: [] });
  useArcadeProgress.setState({ best: { ...useArcadeProgress.getState().best, arena: 0 } });
});
afterEach(() => { drainArenaOutbox(); jest.restoreAllMocks(); });
test('unique durable run IDs and replay never double-award coins, kills, wins or achievements', () => {
  const id = reserveArenaRun(); expect(reserveArenaRun()).toBe(id + 1);
  persistArenaEvent({ type: 'hit', value: 12, perfect: true }, id, 1);
  persistArenaEvent({ type: 'newBest', value: 400 }, id, 2);
  persistArenaEvent({ type: 'gameOver', score: 400, reason: 1 }, id, 3);
  const coins = useProgress.getState().coins, stats = useAchievements.getState().counters;
  expect(stats.arenaKills).toBe(12); expect(stats.arenaWins).toBe(1);
  expect(Object.keys(useAchievements.getState().unlocked)).toEqual(expect.arrayContaining(['first', 'hungry', 'heavy', 'champion']));
  persistArenaEvent({ type: 'gameOver', score: 400, reason: 1 }, id, 3); drainArenaOutbox();
  expect(useProgress.getState().coins).toBe(coins); expect(useAchievements.getState().counters).toEqual(stats);
});
test('Leave durably hands off a failed projection; recovery persists once and clears queue', () => {
  const id = reserveArenaRun();
  const set = mmkv.set.bind(mmkv); let failing = true;
  jest.spyOn(mmkv, 'set').mockImplementation((key: string, value: string | number | boolean | ArrayBuffer) => {
    if (key === 'lumo.progress' && failing) throw new Error('Temporary progress write failure');
    return set(key, value);
  });
  expect(() => persistArenaEvent({ type: 'gameOver', score: 100, reason: 0 }, id, 1)).toThrow();
  const firstCoins = useProgress.getState().coins;
  handoffArenaRun(id);
  persistArenaEvent({ type: 'gameOver', score: 100, reason: 0 }, id, 1);
  expect(JSON.parse(mmkv.getString('lumo.arena.outbox.v1')!)).toHaveLength(1);
  failing = false; drainArenaOutbox();
  expect(useProgress.getState().coins).toBe(firstCoins); expect(useAchievements.getState().counters.playedBy.arena).toBe(1);
  expect(useArenaQueue.getState().pending).toBe(0); expect(useArenaQueue.getState().error).toBeNull();
});
