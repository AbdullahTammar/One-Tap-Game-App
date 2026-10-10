import { ACHIEVEMENTS, type Achievement, type PlayStats } from './achievements';
import { enabledGameIds, GAME_AVAILABILITY, type Availability } from './availability';
const requirements: Record<string, keyof Availability> = {
  duelist: 'duel',
  couple: 'duel',
  chain: 'chain',
  maze: 'tilt',
};
export function playerAchievements(flags: Availability = GAME_AVAILABILITY): Achievement[] {
  const count = enabledGameIds(flags).length;
  return ACHIEVEMENTS.filter((a) => !requirements[a.id] || flags[requirements[a.id]]).map((a) =>
    a.id === 'collector' ? { ...a, goal: count, description: `Play all ${count} games.` } : a,
  );
}
export function playerStats(stats: PlayStats, flags: Availability = GAME_AVAILABILITY): PlayStats {
  const enabled = enabledGameIds(flags),
    playedBy: Record<string, number> = {},
    best: Record<string, number> = {};
  let excludedPlays = 0;
  for (const id of Object.keys(stats.playedBy)) {
    if (enabled.includes(id)) playedBy[id] = stats.playedBy[id];
    else excludedPlays += stats.playedBy[id];
  }
  for (const id of enabled) best[id] = stats.best[id] ?? 0;
  return { ...stats, plays: Math.max(0, stats.plays - excludedPlays), playedBy, best };
}
export const PLAYER_ACHIEVEMENTS = playerAchievements();
