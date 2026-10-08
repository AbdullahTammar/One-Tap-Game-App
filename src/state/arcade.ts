import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArcadeId } from '../game/arcade';
import { MOTION_GAMES, type MotionId } from '../game/motion';
import { persistStorage } from './storage';

export type GameId = ArcadeId | MotionId;
const EMPTY = {
  pulse: 0,
  switch: 0,
  lock: 0,
  ...Object.fromEntries(MOTION_GAMES.map((g) => [g.id, 0])),
} as Record<GameId, number>;
interface ArcadeProgress {
  best: Record<GameId, number>;
  record: (id: GameId, score: number) => void;
}
export const useArcadeProgress = create<ArcadeProgress>()(
  persist(
    (set) => ({
      best: EMPTY,
      record: (id, score) => {
        if (!Number.isSafeInteger(score) || score < 0) return;
        set((s) => ({ best: { ...s.best, [id]: Math.max(s.best[id] ?? 0, score) } }));
      },
    }),
    {
      name: 'lumo-arcade-v1',
      storage: persistStorage,
      // Saves from older versions lack the newer games; keep their zeros instead of `undefined`.
      merge: (saved, current) => ({
        ...current,
        best: { ...EMPTY, ...((saved as Partial<ArcadeProgress> | undefined)?.best ?? {}) },
      }),
    },
  ),
);
