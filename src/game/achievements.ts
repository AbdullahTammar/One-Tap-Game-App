/* eslint-disable @typescript-eslint/no-require-imports -- build-time conditional requires exclude deferred modules */
/** Achievements: pure definitions checked against lifetime stats. Rewards are paid in coins. */
export interface PlayStats {
  plays: number;
  /** Games played per game id, including 'runner' for Dot Runner. */
  playedBy: Record<string, number>;
  /** Best score per game id. */
  best: Record<string, number>;
  arenaKills: number;
  arenaWins: number;
  paintKills: number;
  duelWins: number;
  duoMatches: number;
  linked: number;
  shares: number;
  skinsOwned: number;
  /** Distinct days with at least one game. */
  days: number;
}
export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  reward: number;
  goal: number;
  progress: (s: PlayStats) => number;
}
const best = (id: string) => (s: PlayStats) => s.best[id] ?? 0;
const distinct = (s: PlayStats) => Object.values(s.playedBy).filter((n) => n > 0).length;
export const TOTAL_GAMES = 14;

const deferredAchievements: readonly Achievement[] = process.env.EXPO_PUBLIC_ENABLE_DEFERRED_GAMES === '1' || (__DEV__ && process.env.EXPO_PUBLIC_DEV_DEFERRED_GAMES === '1') || process.env.NODE_ENV === 'test' ? require('./deferredAchievements').DEFERRED_ACHIEVEMENTS : [];
export const ACHIEVEMENTS: readonly Achievement[] = [
  ...deferredAchievements,
  {
    id: 'first',
    icon: '🔵',
    title: 'First Dot',
    description: 'Finish your first game.',
    reward: 50,
    goal: 1,
    progress: (s) => s.plays,
  },
  {
    id: 'explorer',
    icon: '🧭',
    title: 'Explorer',
    description: 'Play 5 different games.',
    reward: 150,
    goal: 5,
    progress: distinct,
  },
  {
    id: 'collector',
    icon: '🗺️',
    title: 'Seen It All',
    description: `Play all ${TOTAL_GAMES} games.`,
    reward: 600,
    goal: TOTAL_GAMES,
    progress: distinct,
  },
  {
    id: 'regular',
    icon: '🎮',
    title: 'Regular',
    description: 'Play 50 games.',
    reward: 300,
    goal: 50,
    progress: (s) => s.plays,
  },
  {
    id: 'marathon',
    icon: '🏃',
    title: 'Marathon',
    description: 'Play 250 games.',
    reward: 1000,
    goal: 250,
    progress: (s) => s.plays,
  },
  {
    id: 'loyal',
    icon: '📅',
    title: 'Loyal Dot',
    description: 'Play on 7 different days.',
    reward: 500,
    goal: 7,
    progress: (s) => s.days,
  },
  {
    id: 'hungry',
    icon: '😋',
    title: 'Hungry Dot',
    description: 'Eat 10 rivals in Dot Arena.',
    reward: 250,
    goal: 10,
    progress: (s) => s.arenaKills,
  },
  {
    id: 'heavy',
    icon: '🐘',
    title: 'Heavyweight',
    description: 'Reach 300 mass in Dot Arena.',
    reward: 300,
    goal: 300,
    progress: best('arena'),
  },
  {
    id: 'champion',
    icon: '👑',
    title: 'Arena Champion',
    description: 'Finish a Dot Arena match in 1st place.',
    reward: 600,
    goal: 1,
    progress: (s) => s.arenaWins,
  },
  {
    id: 'painter',
    icon: '🎨',
    title: 'Painter',
    description: 'Own 30% of the map in Dot Paint.',
    reward: 300,
    goal: 30,
    progress: best('paint'),
  },
  {
    id: 'cutter',
    icon: '✂️',
    title: 'Trail Cutter',
    description: 'Cut 5 rival trails in Dot Paint.',
    reward: 250,
    goal: 5,
    progress: (s) => s.paintKills,
  },


  {
    id: 'runner',
    icon: '⚡',
    title: 'Gate Crasher',
    description: 'Score 50 in Dot Runner.',
    reward: 300,
    goal: 50,
    progress: best('runner'),
  },
  {
    id: 'pulse',
    icon: '💓',
    title: 'In the Pocket',
    description: 'Score 30 in Dot Pulse.',
    reward: 200,
    goal: 30,
    progress: best('pulse'),
  },
  {
    id: 'switch',
    icon: '🔀',
    title: 'Lane Master',
    description: 'Score 30 in Dot Switch.',
    reward: 200,
    goal: 30,
    progress: best('switch'),
  },
  {
    id: 'lock',
    icon: '🎯',
    title: 'Lock Smith',
    description: 'Score 30 in Dot Lock.',
    reward: 200,
    goal: 30,
    progress: best('lock'),
  },
  {
    id: 'combo',
    icon: '🔥',
    title: 'Combo King',
    description: 'Score 100 in Dot Drift.',
    reward: 250,
    goal: 100,
    progress: best('drift'),
  },
  {
    id: 'hopper',
    icon: '🦘',
    title: 'Sky Hopper',
    description: 'Land 25 pads in Dot Jump.',
    reward: 250,
    goal: 25,
    progress: best('charge'),
  },
  {
    id: 'sorter',
    icon: '🧩',
    title: 'Sorting Pro',
    description: 'Sort 50 dots in Dot Sort.',
    reward: 250,
    goal: 50,
    progress: best('swipe'),
  },

  {
    id: 'linker',
    icon: '🔗',
    title: 'Loop Artist',
    description: 'Link 1,000 dots in Dot Link.',
    reward: 400,
    goal: 1000,
    progress: (s) => s.linked,
  },

  {
    id: 'stacker',
    icon: '🏗️',
    title: 'Tower Builder',
    description: 'Score 60 in Dot Stack.',
    reward: 300,
    goal: 60,
    progress: best('stack'),
  },
  {
    id: 'fashion',
    icon: '👗',
    title: 'Fashionista',
    description: 'Own 15 skins.',
    reward: 400,
    goal: 15,
    progress: (s) => s.skinsOwned,
  },
  {
    id: 'sharer',
    icon: '📣',
    title: 'Show Off',
    description: 'Share a score with a friend.',
    reward: 100,
    goal: 1,
    progress: (s) => s.shares,
  },
];

export function isUnlocked(a: Achievement, s: PlayStats) {
  return a.progress(s) >= a.goal;
}
/** Achievements newly met by `stats` that are not yet in `unlocked`. */
export function newlyUnlocked(stats: PlayStats, unlocked: Record<string, number>) {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && isUnlocked(a, stats));
}

/** Coins paid for finishing a non-Runner game, scaled so a good run in any game pays about the same. */
const COIN_RATE: Record<string, number> = {
  arena: 0.08,
  paint: 0.6,
  duel: 3,
  drift: 0.3,
  charge: 1,
  swipe: 0.6,
  chain: 0.25,
  flow: 0.2,
  tilt: 2,
  stack: 0.5,
  pulse: 1,
  switch: 1,
  lock: 1,
};
export function coinsFor(id: string, score: number) {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(40, Math.floor(score * (COIN_RATE[id] ?? 0.5)));
}
