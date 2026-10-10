import { PLAYER_ACHIEVEMENTS, playerStats } from '../game/achievementAvailability';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { coinsFor, newlyUnlocked, type Achievement, type PlayStats } from '../game/achievements';
import { dayKey } from '../utils/date';
import { useArcadeProgress } from './arcade';
import { useProgress } from './progress';
import { persistStorage } from './storage';

type Counters = Omit<PlayStats, 'best' | 'skinsOwned'>;
export interface GameReport {
  id: string;
  score: number;
  arenaKills?: number;
  arenaWin?: boolean;
  paintKills?: number;
  duelWin?: boolean;
  duo?: boolean;
  linked?: number;
}
interface AchievementState {
  counters: Counters;
  lastDay: string | null;
  unlocked: Record<string, number>;
  /** Unlocks waiting to be shown; not persisted. */
  toasts: Achievement[];
  reportGame: (r: GameReport) => { coins: number; unlocked: Achievement[] };
  reportShare: () => void;
  /** Re-checks goals that can change outside a game, such as skins owned. */
  refresh: () => void;
  dismissToast: () => void;
}
const EMPTY: Counters = {
  plays: 0,
  playedBy: {},
  arenaKills: 0,
  arenaWins: 0,
  paintKills: 0,
  duelWins: 0,
  duoMatches: 0,
  linked: 0,
  shares: 0,
  days: 0,
};
export function currentStats(counters: Counters): PlayStats {
  const progress = useProgress.getState();
  return {
    ...counters,
    best: { ...useArcadeProgress.getState().best, runner: progress.best },
    skinsOwned: progress.owned.length,
  };
}
export const useAchievements = create<AchievementState>()(
  persist(
    (set, get) => {
      const unlockAll = (counters: Counters, legacy = false) => {
        const stats = playerStats(currentStats(counters));
        const fresh = legacy
          ? newlyUnlocked(currentStats(counters), get().unlocked)
          : PLAYER_ACHIEVEMENTS.filter((a) => !get().unlocked[a.id] && a.progress(stats) >= a.goal);
        if (!fresh.length) return fresh;
        const now = Date.now();
        set((s) => ({
          unlocked: { ...s.unlocked, ...Object.fromEntries(fresh.map((a) => [a.id, now])) },
          toasts: [...s.toasts, ...fresh],
        }));
        useProgress.getState().addCoins(fresh.reduce((sum, a) => sum + a.reward, 0));
        return fresh;
      };
      return {
        counters: EMPTY,
        lastDay: null,
        unlocked: {},
        toasts: [],
        reportGame: (r) => {
          const c = get().counters;
          const today = dayKey();
          const counters: Counters = {
            ...c,
            plays: c.plays + 1,
            playedBy: { ...c.playedBy, [r.id]: (c.playedBy[r.id] ?? 0) + 1 },
            arenaKills: c.arenaKills + (r.arenaKills ?? 0),
            arenaWins: c.arenaWins + (r.arenaWin ? 1 : 0),
            paintKills: c.paintKills + (r.paintKills ?? 0),
            duelWins: c.duelWins + (r.duelWin ? 1 : 0),
            duoMatches: c.duoMatches + (r.duo ? 1 : 0),
            linked: c.linked + (r.linked ?? 0),
            days: c.days + (get().lastDay === today ? 0 : 1),
          };
          set({ counters, lastDay: today });
          // Dot Runner pays its own coins through the run economy.
          const coins = r.id === 'runner' ? 0 : coinsFor(r.id, r.score);
          if (coins) useProgress.getState().addCoins(coins);
          return { coins, unlocked: unlockAll(counters, r.id === 'duel' || r.id === 'chain' || r.id === 'tilt') };
        },
        reportShare: () => {
          const counters = { ...get().counters, shares: get().counters.shares + 1 };
          set({ counters });
          unlockAll(counters);
        },
        refresh: () => {
          unlockAll(get().counters);
        },
        dismissToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
      };
    },
    {
      name: 'lumo.achievements',
      storage: persistStorage,
      partialize: (s) => ({ counters: s.counters, lastDay: s.lastDay, unlocked: s.unlocked }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<AchievementState>;
        return { ...current, ...p, counters: { ...EMPTY, ...(p.counters ?? {}) }, toasts: [] };
      },
    },
  ),
);
