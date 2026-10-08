import type { DiscreteEvent } from './events';

export const MAX_AUTO_RETRIES = 2;
export type DeliveryFailure = { status: 'retrying' | 'recoverable'; message: string; retries: number };
export interface DeliveryCallbacks {
  deliver: (batch: readonly number[]) => number;
  success: (sequence: number) => void;
  failure: (error: unknown, state: DeliveryFailure) => void;
}
/** RN-only controller. The immutable journal batch is retained through two automatic retries. */
export function createDeliveryController(callbacks: DeliveryCallbacks) {
  let batch: readonly number[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retries = 0;
  let disposed = false;
  const attempt = () => {
    if (disposed || !batch) return;
    let sequence: number;
    try {
      sequence = callbacks.deliver(batch);
    } catch (error) {
      const exhausted = retries >= MAX_AUTO_RETRIES;
      callbacks.failure(error, {
        status: exhausted ? 'recoverable' : 'retrying',
        message: error instanceof Error ? error.message : String(error),
        retries,
      });
      if (!exhausted) {
        const delay = 250 * (retries + 1);
        retries++;
        timer = setTimeout(() => {
          timer = null;
          attempt();
        }, delay);
      }
      return;
    }
    batch = null;
    retries = 0;
    callbacks.success(sequence);
  };
  return {
    activate() {
      disposed = false;
      if (batch && !timer) attempt();
    },
    receive(next: readonly number[]) {
      if (disposed) return;
      if (batch) throw new Error('Delivery controller already has an in-flight batch');
      batch = next;
      retries = 0;
      attempt();
    },
    retry() {
      if (disposed || !batch || timer) return;
      retries = 0;
      attempt();
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** Persistence boundary: event effects and the (session,sequence) receipt must commit atomically. */
export interface IdempotentEventStore {
  applyOnce: (session: number, sequence: number, event: DiscreteEvent) => void;
}
export function createPersistingHandler(store: IdempotentEventStore) {
  return (event: DiscreteEvent, session: number, sequence: number) => store.applyOnce(session, sequence, event);
}
export interface ReceiptSnapshot<T> {
  data: T;
  receipts: Record<string, true>;
}
export interface AtomicSnapshotStorage<T> {
  read: () => ReceiptSnapshot<T>;
  write: (snapshot: ReceiptSnapshot<T>) => void;
}
/** RN-only, single-writer adapter: one durable snapshot write commits both effect and receipt. */
export function createAtomicEventStore<T>(
  storage: AtomicSnapshotStorage<T>,
  reduce: (data: T, event: DiscreteEvent) => T,
): IdempotentEventStore {
  return {
    applyOnce(session, sequence, event) {
      const key = `${session}:${sequence}`,
        snapshot = storage.read();
      if (snapshot.receipts[key]) return;
      storage.write({ data: reduce(snapshot.data, event), receipts: { ...snapshot.receipts, [key]: true } });
    },
  };
}
