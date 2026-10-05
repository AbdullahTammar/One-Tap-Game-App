/**
 * Web preview only: AdMob has no web SDK. Rewarded ads are simulated so the
 * continue / double-coins / free-coins flows can be exercised in a browser.
 */
import { create } from 'zustand';

interface AdState {
  initialized: boolean;
  rewardedReady: boolean;
  privacyOptionsRequired: boolean;
}

export const useAdState = create<AdState>(() => ({
  initialized: true,
  rewardedReady: true,
  privacyOptionsRequired: false,
}));

export async function initAds(): Promise<void> {}

export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => setTimeout(() => resolve(true), 400));
}

export async function maybeShowInterstitial(): Promise<void> {}

export async function showPrivacyOptions(): Promise<void> {}
