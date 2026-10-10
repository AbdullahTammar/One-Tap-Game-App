import type { Achievement } from './achievements';
const best = (id: string) => (s: import('./achievements').PlayStats) => s.best[id] ?? 0;
export const DEFERRED_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'duelist',
    icon: '🏒',
    title: 'Duelist',
    description: 'Win a Dot Duel.',
    reward: 200,
    goal: 1,
    progress: (s) => s.duelWins,
  },
  {
    id: 'couple',
    icon: '💞',
    title: 'Better Together',
    description: 'Play 3 two-player Dot Duels.',
    reward: 250,
    goal: 3,
    progress: (s) => s.duoMatches,
  },
  {
    id: 'chain',
    icon: '💥',
    title: 'Chain Master',
    description: 'Pop 150 dots in one Dot Chain run.',
    reward: 300,
    goal: 150,
    progress: best('chain'),
  },
  {
    id: 'maze',
    icon: '🌀',
    title: 'Escape Artist',
    description: 'Escape 10 mazes in one Dot Maze run.',
    reward: 300,
    goal: 10,
    progress: best('tilt'),
  },
];
