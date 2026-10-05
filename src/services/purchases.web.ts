/** Web preview only: store purchases exist only on iOS / Android. */
import { create } from 'zustand';

import type { ProductId } from './config';

interface PurchaseState {
  available: boolean;
  prices: Partial<Record<ProductId, string>>;
  busy: ProductId | 'restore' | null;
}

export const usePurchaseState = create<PurchaseState>(() => ({ available: false, prices: {}, busy: null }));

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable' | 'error';

export async function initPurchases(): Promise<void> {}

export async function purchase(_id: ProductId): Promise<PurchaseResult> {
  return 'unavailable';
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return 'unavailable';
}
