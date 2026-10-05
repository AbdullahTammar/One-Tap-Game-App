import * as StoreReview from 'expo-store-review';

import { useSettings } from '../state/settings';

const MIN_GAMES = 8;
const COOLDOWN_MS = 90 * 24 * 3600 * 1000;

/**
 * Ask for a rating at a happy moment (a new personal best), only for engaged
 * players, at most once a quarter. The OS applies its own limits on top.
 */
export async function maybeRequestReview(totalGames: number, newBest: boolean): Promise<void> {
  const settings = useSettings.getState();
  if (!newBest || totalGames < MIN_GAMES) return;
  if (Date.now() - settings.reviewRequestedAt < COOLDOWN_MS) return;
  try {
    if (!(await StoreReview.hasAction())) return;
    settings.set('reviewRequestedAt', Date.now());
    await StoreReview.requestReview();
  } catch {
    // Non-critical.
  }
}
