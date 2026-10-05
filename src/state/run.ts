import { create } from 'zustand';

/** In-memory (not persisted) hand-off between the Play and Results screens. */
export interface RunSummary {
  score: number;
  perfects: number;
  bestCombo: number;
  /** Top speed as a multiple of the start speed. */
  topSpeed: number;
  coinsEarned: number;
  dailyBonus: number;
  newBest: boolean;
  previousBest: number;
  canContinue: boolean;
  doubled: boolean;
}

export type RunRequest = 'continue' | 'retry' | null;

interface RunStore {
  last: RunSummary | null;
  request: RunRequest;
  setLast: (summary: RunSummary | null) => void;
  patchLast: (patch: Partial<RunSummary>) => void;
  setRequest: (r: RunRequest) => void;
}

export const useRun = create<RunStore>((set, get) => ({
  last: null,
  request: null,
  setLast: (last) => set({ last }),
  patchLast: (patch) => {
    const last = get().last;
    if (last) set({ last: { ...last, ...patch } });
  },
  setRequest: (request) => set({ request }),
}));
