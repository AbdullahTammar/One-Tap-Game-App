/**
 * Ads: Google UMP consent (GDPR/CCPA) -> iOS ATT -> AdMob init, then
 * pre-loaded rewarded + interstitial units with player-friendly pacing.
 *
 * Every entry point is fail-safe: if ads can't load (no network, no consent,
 * no fill) the game simply continues without them.
 */
import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { create } from 'zustand';

import { useSettings } from '../state/settings';
import { AdPacing, AdUnits } from './config';

interface AdState {
  initialized: boolean;
  rewardedReady: boolean;
  privacyOptionsRequired: boolean;
}

export const useAdState = create<AdState>(() => ({
  initialized: false,
  rewardedReady: false,
  privacyOptionsRequired: false,
}));

const unitId = (prod: string | undefined, test: string): string => (__DEV__ || !prod ? test : prod);

let rewarded: RewardedAd | null = null;
let interstitial: InterstitialAd | null = null;
let initPromise: Promise<void> | null = null;
let showing = false;

export function initAds(): Promise<void> {
  if (!initPromise)
    initPromise = doInit().catch((e) => {
      if (__DEV__) console.warn('[ads] init failed', e);
    });
  return initPromise;
}

async function doInit(): Promise<void> {
  const consent = await AdsConsent.gatherConsent().catch(() => null);
  useAdState.setState({
    privacyOptionsRequired:
      consent?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  });
  if (consent && !consent.canRequestAds) return;

  if (Platform.OS === 'ios') {
    // ATT must come after the UMP form; a denial still allows non-personalised ads.
    const att = await import('expo-tracking-transparency');
    await att.requestTrackingPermissionsAsync().catch(() => null);
  }

  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
  useAdState.setState({ initialized: true });
  loadRewarded();
  loadInterstitial();
}

function loadRewarded(): void {
  rewarded = RewardedAd.createForAdRequest(unitId(AdUnits.rewarded, TestIds.REWARDED));
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => useAdState.setState({ rewardedReady: true }));
  rewarded.addAdEventListener(AdEventType.ERROR, () => {
    useAdState.setState({ rewardedReady: false });
    setTimeout(loadRewarded, 30_000);
  });
  rewarded.load();
}

function loadInterstitial(): void {
  interstitial = InterstitialAd.createForAdRequest(unitId(AdUnits.interstitial, TestIds.INTERSTITIAL));
  interstitial.addAdEventListener(AdEventType.ERROR, () => setTimeout(loadInterstitial, 60_000));
  interstitial.load();
}

/** Shows a rewarded ad. Resolves true only if the player earned the reward. */
export function showRewarded(): Promise<boolean> {
  const ad = rewarded;
  if (!ad || !ad.loaded || showing) return Promise.resolve(false);
  showing = true;
  return new Promise<boolean>((resolve) => {
    let earned = false;
    const offs: (() => void)[] = [];
    const finish = () => {
      offs.forEach((off) => off());
      showing = false;
      useAdState.setState({ rewardedReady: false });
      loadRewarded();
      resolve(earned);
    };
    offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => (earned = true)));
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
    ad.show().catch(finish);
  });
}

/** Call at the end of each run. Shows an interstitial only when pacing allows. */
export async function maybeShowInterstitial(): Promise<void> {
  const settings = useSettings.getState();
  const runs = settings.runsSinceInterstitial + 1;
  const lifetime = settings.lifetimeRuns + 1;
  settings.set('runsSinceInterstitial', runs);
  settings.set('lifetimeRuns', lifetime);

  const ad = interstitial;
  const elapsed = (Date.now() - settings.lastInterstitialAt) / 1000;
  if (
    settings.adsRemoved ||
    showing ||
    !ad?.loaded ||
    lifetime <= AdPacing.graceRuns ||
    runs < AdPacing.runsBetween ||
    elapsed < AdPacing.minSecondsBetween
  ) {
    return;
  }

  showing = true;
  await new Promise<void>((resolve) => {
    const offs: (() => void)[] = [];
    const finish = () => {
      offs.forEach((off) => off());
      showing = false;
      loadInterstitial();
      resolve();
    };
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
    ad.show().then(() => {
      settings.set('runsSinceInterstitial', 0);
      settings.set('lastInterstitialAt', Date.now());
    }, finish);
  });
}

/** Re-opens the consent form (required "Privacy options" entry in Settings). */
export async function showPrivacyOptions(): Promise<void> {
  await AdsConsent.showPrivacyOptionsForm().catch(() => null);
}
