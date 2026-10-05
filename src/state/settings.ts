import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { accentColor, DEFAULT_ACCENT, type AccentId } from '../theme';
import { persistStorage } from './storage';

export interface SettingsData {
  sound: boolean;
  haptics: boolean;
  accent: AccentId;
  /** Lifetime "Remove ads" entitlement (mirrored from the store). */
  adsRemoved: boolean;
  /** Store transaction ids whose coins were already credited (idempotency). */
  grantedTransactions: string[];
  /** Interstitial pacing. */
  runsSinceInterstitial: number;
  lastInterstitialAt: number;
  /** Runs completed across all sessions — gates first-session ad exposure. */
  lifetimeRuns: number;
  reviewRequestedAt: number;
  /** Rewarded "free coins" daily cap. */
  freeCoinsDay: string | null;
  freeCoinsCount: number;
}

interface SettingsActions {
  set: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  toggle: (key: 'sound' | 'haptics') => void;
  markTransactionsGranted: (ids: string[]) => void;
}

export const initialSettings: SettingsData = {
  sound: true,
  haptics: true,
  accent: DEFAULT_ACCENT,
  adsRemoved: false,
  grantedTransactions: [],
  runsSinceInterstitial: 0,
  lastInterstitialAt: 0,
  lifetimeRuns: 0,
  reviewRequestedAt: 0,
  freeCoinsDay: null,
  freeCoinsCount: 0,
};

export const useSettings = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => ({
      ...initialSettings,
      set: (key, value) => set({ [key]: value } as Pick<SettingsData, typeof key>),
      toggle: (key) => set({ [key]: !get()[key] } as Pick<SettingsData, typeof key>),
      markTransactionsGranted: (ids) =>
        set({ grantedTransactions: Array.from(new Set([...get().grantedTransactions, ...ids])) }),
    }),
    {
      name: 'lumo.settings',
      version: 1,
      storage: persistStorage,
      partialize: (s): SettingsData => ({
        sound: s.sound,
        haptics: s.haptics,
        accent: s.accent,
        adsRemoved: s.adsRemoved,
        grantedTransactions: s.grantedTransactions,
        runsSinceInterstitial: s.runsSinceInterstitial,
        lastInterstitialAt: s.lastInterstitialAt,
        lifetimeRuns: s.lifetimeRuns,
        reviewRequestedAt: s.reviewRequestedAt,
        freeCoinsDay: s.freeCoinsDay,
        freeCoinsCount: s.freeCoinsCount,
      }),
    },
  ),
);

export function useAccent(): string {
  return accentColor(useSettings((s) => s.accent));
}
