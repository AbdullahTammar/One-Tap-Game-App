import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ECONOMY } from '../game/constants';
import { DEFAULT_SKIN_ID, STARTER_SKIN_IDS } from '../game/skins';
import { dayKey } from '../utils/date';
import {
  amendRun,
  applyRun,
  rollDay,
  selectSkin,
  type ProgressData,
  type RunInput,
  type RunOutcome,
  type SkinAction,
} from './progressLogic';
import { persistStorage } from './storage';

export const initialProgress: ProgressData = {
  coins: ECONOMY.starterCoins,
  best: 0,
  totalGames: 0,
  totalGates: 0,
  totalPerfects: 0,
  owned: [...STARTER_SKIN_IDS],
  equipped: DEFAULT_SKIN_ID,
  streak: 0,
  lastPlayDay: null,
  dailyDay: null,
  dailyGates: 0,
  dailyClaimed: false,
  topRuns: [],
};

interface ProgressActions {
  recordRun: (run: RunInput) => RunOutcome;
  amendRun: (original: Parameters<typeof amendRun>[1], run: RunInput) => RunOutcome;
  /** Grants the coin difference when a finished run is upgraded to "doubled". */
  addCoins: (amount: number) => void;
  selectSkin: (id: string) => SkinAction;
  refreshDay: () => void;
  reset: () => void;
}

export const useProgress = create<ProgressData & ProgressActions>()(
  persist(
    (set, get) => ({
      ...initialProgress,
      recordRun: (run) => {
        const { next, outcome } = applyRun(get(), run);
        set(next);
        return outcome;
      },
      amendRun: (original, run) => {
        const { next, outcome } = amendRun(get(), original, run);
        set(next);
        return outcome;
      },
      addCoins: (amount) => {
        if (amount > 0) set({ coins: get().coins + Math.floor(amount) });
      },
      selectSkin: (id) => {
        const { next, action } = selectSkin(get(), id);
        if (action !== 'noop' && action !== 'insufficient') set(next);
        return action;
      },
      refreshDay: () => {
        const p = get();
        const next = rollDay(p, dayKey());
        if (next !== p) set(next);
      },
      reset: () => set(initialProgress),
    }),
    {
      name: 'lumo.progress',
      version: 1,
      storage: persistStorage,
      partialize: (s): ProgressData => {
        const data = {} as Record<string, unknown>;
        for (const key of Object.keys(initialProgress) as (keyof ProgressData)[]) data[key] = s[key];
        return data as unknown as ProgressData;
      },
    },
  ),
);
