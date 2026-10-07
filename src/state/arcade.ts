import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArcadeId } from '../game/arcade';
import { persistStorage } from './storage';

interface ArcadeProgress {
  best: Record<ArcadeId, number>;
  record: (id: ArcadeId, score: number) => void;
}
export const useArcadeProgress = create<ArcadeProgress>()(
  persist(
    (set) => ({
      best: { pulse: 0, switch: 0, lock: 0 },
      record: (id, score) => {
        if (!Number.isSafeInteger(score) || score < 0) return;
        set((s) => ({ best: { ...s.best, [id]: Math.max(s.best[id], score) } }));
      },
    }),
    { name: 'lumo-arcade-v1', storage: persistStorage },
  ),
);
