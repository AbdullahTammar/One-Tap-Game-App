import { Platform } from 'react-native';

/**
 * Runtime keys come from EXPO_PUBLIC_* env vars (see .env.example) so no
 * secrets or per-store ids live in source. In development, or when a value is
 * missing, Google's official test ad units are used — never real ones.
 */
const env = process.env;

const pick = (ios?: string, android?: string): string | undefined =>
  Platform.select({ ios, android, default: undefined }) || undefined;

export const AdUnits = {
  rewarded: pick(env.EXPO_PUBLIC_ADMOB_IOS_REWARDED, env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED),
  interstitial: pick(env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL, env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL),
  banner: pick(env.EXPO_PUBLIC_ADMOB_IOS_BANNER, env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER),
};

export const RevenueCatKey = pick(env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY);

export const Links = {
  privacy: env.EXPO_PUBLIC_PRIVACY_URL || 'https://example.com/lumo/privacy',
  terms: env.EXPO_PUBLIC_TERMS_URL || 'https://example.com/lumo/terms',
  support: env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
};

/** Store product identifiers — create these exact ids in App Store Connect and Google Play Console. */
export const Products = {
  removeAds: 'lumo_remove_ads',
  coinsSmall: 'lumo_coins_1000',
  coinsMedium: 'lumo_coins_6000',
  coinsLarge: 'lumo_coins_15000',
  starterPack: 'lumo_starter_pack',
} as const;

export type ProductId = (typeof Products)[keyof typeof Products];

export interface CoinPack {
  id: ProductId;
  coins: number;
  removesAds?: boolean;
  title: string;
  badge?: string;
  /** Shown until the store returns a localized price. */
  fallbackPrice: string;
}

export const CATALOG: readonly CoinPack[] = [
  {
    id: Products.starterPack,
    coins: 2500,
    removesAds: true,
    title: 'Starter pack',
    badge: 'Best value',
    fallbackPrice: '$3.99',
  },
  { id: Products.removeAds, coins: 0, removesAds: true, title: 'Remove ads', fallbackPrice: '$2.99' },
  { id: Products.coinsSmall, coins: 1000, title: '1,000 coins', fallbackPrice: '$0.99' },
  { id: Products.coinsMedium, coins: 6000, title: '6,000 coins', badge: '+20%', fallbackPrice: '$4.99' },
  { id: Products.coinsLarge, coins: 15000, title: '15,000 coins', badge: '+50%', fallbackPrice: '$9.99' },
];

/**
 * Master switch for ads. Paused for now; set to true before the production release.
 * The ad code stays in place; with this off the SDK is never initialised, so no ad can load or show.
 */
export const AdsEnabled = false;

/** Ad pacing — tuned to protect retention: never in the first runs, never back-to-back. */
export const AdPacing = {
  graceRuns: 3,
  runsBetween: 3,
  minSecondsBetween: 120,
} as const;

/** Rewarded "free coins" offer in the shop. */
export const FreeCoins = { amount: 60, perDay: 5 } as const;
