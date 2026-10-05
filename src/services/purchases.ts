/**
 * In-app purchases via RevenueCat (StoreKit 2 + Google Play Billing, receipt
 * validation server-side, one API for both stores).
 *
 * Coin grants are idempotent: each store transaction id is credited once.
 * Without an API key (local dev) the shop shows fallback prices and purchases
 * are disabled — the rest of the game is unaffected.
 */
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type PurchasesStoreProduct,
  type PurchasesStoreTransaction,
} from 'react-native-purchases';
import { create } from 'zustand';

import { useProgress } from '../state/progress';
import { useSettings } from '../state/settings';
import { CATALOG, RevenueCatKey, type ProductId } from './config';

interface PurchaseState {
  available: boolean;
  prices: Partial<Record<ProductId, string>>;
  busy: ProductId | 'restore' | null;
}

export const usePurchaseState = create<PurchaseState>(() => ({ available: false, prices: {}, busy: null }));

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable' | 'error';

const products = new Map<string, PurchasesStoreProduct>();
/** Missed grants (e.g. app killed mid-purchase) are recovered within this window. */
const RECOVERY_WINDOW_MS = 72 * 3600 * 1000;
let initPromise: Promise<void> | null = null;

export function initPurchases(): Promise<void> {
  if (!initPromise)
    initPromise = doInit().catch((e) => {
      if (__DEV__) console.warn('[iap] init failed', e);
    });
  return initPromise;
}

async function doInit(): Promise<void> {
  if (!RevenueCatKey) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: RevenueCatKey });
  Purchases.addCustomerInfoUpdateListener(syncCustomerInfo);

  const list = await Purchases.getProducts(
    CATALOG.map((p) => p.id),
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  const prices: PurchaseState['prices'] = {};
  list.forEach((p) => {
    products.set(p.identifier, p);
    prices[p.identifier as ProductId] = p.priceString;
  });
  usePurchaseState.setState({ available: list.length > 0, prices });
  syncCustomerInfo(await Purchases.getCustomerInfo());
}

function grant(tx: PurchasesStoreTransaction): void {
  const settings = useSettings.getState();
  if (settings.grantedTransactions.includes(tx.transactionIdentifier)) return;
  const item = CATALOG.find((c) => c.id === tx.productIdentifier);
  if (!item) return;
  if (item.coins > 0) useProgress.getState().addCoins(item.coins);
  if (item.removesAds) settings.set('adsRemoved', true);
  settings.markTransactionsGranted([tx.transactionIdentifier]);
}

function syncCustomerInfo(info: CustomerInfo): void {
  const removesAds = CATALOG.filter((c) => c.removesAds).map((c) => c.id as string);
  if (info.allPurchasedProductIdentifiers.some((id) => removesAds.includes(id))) {
    useSettings.getState().set('adsRemoved', true);
  }
  const cutoff = Date.now() - RECOVERY_WINDOW_MS;
  info.nonSubscriptionTransactions.filter((tx) => Date.parse(tx.purchaseDate) >= cutoff).forEach(grant);
}

export async function purchase(id: ProductId): Promise<PurchaseResult> {
  const product = products.get(id);
  if (!product) return 'unavailable';
  usePurchaseState.setState({ busy: id });
  try {
    const result = await Purchases.purchaseStoreProduct(product);
    grant(result.transaction);
    syncCustomerInfo(result.customerInfo);
    return 'success';
  } catch (e) {
    return (e as { userCancelled?: boolean | null }).userCancelled ? 'cancelled' : 'error';
  } finally {
    usePurchaseState.setState({ busy: null });
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!usePurchaseState.getState().available) return 'unavailable';
  usePurchaseState.setState({ busy: 'restore' });
  try {
    syncCustomerInfo(await Purchases.restorePurchases());
    return 'success';
  } catch {
    return 'error';
  } finally {
    usePurchaseState.setState({ busy: null });
  }
}
