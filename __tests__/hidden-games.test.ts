import { enabledGameIds, GAME_AVAILABILITY, gameEnabled } from '../src/game/availability';
import { playerAchievements, playerStats } from '../src/game/achievementAvailability';
import { MOTION_GAMES } from '../src/game/motion';
import { useArcadeProgress } from '../src/state/arcade';
import { currentStats, useAchievements } from '../src/state/achievements';

test('default catalog exposes eleven games and redirects disabled IDs through the route guard', () => {
  expect(enabledGameIds()).toHaveLength(11);
  expect(MOTION_GAMES.filter((g) => g.enabled)).toHaveLength(7);
  for (const id of ['duel', 'chain', 'tilt']) {
    expect(gameEnabled(id)).toBe(false);
    expect(MOTION_GAMES.find((g) => g.id === id)?.enabled).toBe(false);
  }
  expect(gameEnabled('unknown')).toBe(false);
});
test('achievements and player totals omit deferred entries without deleting saves; flag flip restores them', () => {
  const stats = currentStats(useAchievements.getState().counters);
  stats.plays = 9;
  stats.playedBy = { arena: 3, duel: 2, chain: 1, tilt: 3 };
  const visible = playerStats(stats);
  expect(visible.plays).toBe(3);
  expect(visible.playedBy).toEqual({ arena: 3 });
  expect(stats.playedBy.duel).toBe(2);
  expect(playerAchievements()).toHaveLength(22);
  expect(playerAchievements().find((a) => a.id === 'collector')?.goal).toBe(11);
  const flags = { ...GAME_AVAILABILITY, duel: true, chain: true, tilt: true };
  expect(enabledGameIds(flags)).toHaveLength(14);
  expect(playerAchievements(flags)).toHaveLength(26);
  expect(playerStats(stats, flags).plays).toBe(9);
  useArcadeProgress.getState().record('duel', 5);
  expect(useArcadeProgress.getState().best.duel).toBe(5);
});
