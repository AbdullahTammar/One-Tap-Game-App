import { create } from 'zustand';
import { createAtomicEventStore, type ReceiptSnapshot } from '../game/core/delivery';
import type { DiscreteEvent } from '../game/core/events';
import { useAchievements, type GameReport } from '../state/achievements';
import { useProgress } from '../state/progress';
import { useArcadeProgress } from '../state/arcade';
import { mmkv } from '../state/storage';

interface Run {
  score: number;
  kills: number;
  final?: GameReport;
  finalSequence?: number;
}
interface Ledger {
  runs: Record<string, Run>;
}
interface Packet {
  session: number;
  sequence: number;
  event: DiscreteEvent;
}
const OUTBOX = 'lumo.arena.outbox.v1',
  LEDGER = 'lumo.arena.ledger.v1',
  NEXT = 'lumo.arena.nextRun.v1';
const handedOff = new Set<number>();
export const useArenaQueue = create<{ pending: number; error: string | null }>(() => ({ pending: 0, error: null }));
let timer: ReturnType<typeof setTimeout> | null = null;
const readOutbox = (): Packet[] => JSON.parse(mmkv.getString(OUTBOX) ?? '[]');
const readLedger = (): ReceiptSnapshot<Ledger> =>
  JSON.parse(mmkv.getString(LEDGER) ?? '{"data":{"runs":{}},"receipts":{}}');
export function reserveArenaRun(): number {
  const previous = Number(mmkv.getString(NEXT) ?? 0);
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER)
    throw new Error('Arena run counter invalid');
  const id = previous + 1;
  mmkv.set(NEXT, String(id));
  return id;
}
function project(packet: Packet) {
  const run = readLedger().data.runs[packet.session];
  if (!run) return;
  if (packet.event.type === 'newBest' || packet.event.type === 'gameOver') {
    const best = useArcadeProgress.getState().best;
    useArcadeProgress.setState({ best: { ...best, arena: Math.max(best.arena ?? 0, run.score) } });
  }
  if (packet.event.type === 'gameOver' && run.final) {
    const key = `${packet.session}:${packet.sequence}`;
    const award = useAchievements.getState().applyArenaReport(key, run.final);
    useProgress.getState().applyArenaAward(key, award.total);
  }
}
function commit(packet: Packet) {
  const store = createAtomicEventStore<Ledger>(
    {
      read: readLedger,
      write: (snapshot) => {
        const finalSequence = snapshot.data.runs[packet.session]?.finalSequence;
        if (finalSequence)
          for (const key of Object.keys(snapshot.receipts)) {
            if (key.startsWith(`${packet.session}:`) && key !== `${packet.session}:${finalSequence}`)
              delete snapshot.receipts[key];
          }
        mmkv.set(LEDGER, JSON.stringify(snapshot));
      },
    },
    (data, event) => {
      const run = { ...(data.runs[packet.session] ?? { score: 0, kills: 0 }) };
      if (run.finalSequence && packet.sequence <= run.finalSequence) return data;
      if (event.type === 'hit') run.kills = Math.max(run.kills, event.value);
      if (event.type === 'score' || event.type === 'newBest') run.score = Math.max(run.score, event.value);
      if (event.type === 'gameOver') {
        run.score = event.score;
        run.finalSequence = packet.sequence;
        run.final = { id: 'arena', score: event.score, arenaKills: run.kills, arenaWin: event.reason === 1 };
      }
      return { runs: { ...data.runs, [packet.session]: run } };
    },
  );
  store.applyOnce(packet.session, packet.sequence, packet.event);
  project(packet);
}
function scheduleDrain() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    drainArenaOutbox();
  }, 2000);
}
export function drainArenaOutbox() {
  try {
    const queue = readOutbox();
    for (const packet of queue) {
      commit(packet);
      const remaining = readOutbox().filter((p) => p.session !== packet.session || p.sequence !== packet.sequence);
      mmkv.set(OUTBOX, JSON.stringify(remaining));
    }
    useArenaQueue.setState({ pending: readOutbox().length, error: null });
    if (timer) { clearTimeout(timer); timer = null; }
  } catch (error) {
    useArenaQueue.setState({ error: error instanceof Error ? error.message : String(error) });
    scheduleDrain();
  }
}
/** First serialize the small event durably. UI acknowledgement follows either committed projection or durable handoff. */
export function persistArenaEvent(event: DiscreteEvent, session: number, sequence: number) {
  const queue = readOutbox();
  if (!queue.some((p) => p.session === session && p.sequence === sequence)) {
    queue.push({ session, sequence, event });
    mmkv.set(OUTBOX, JSON.stringify(queue));
  }
  useArenaQueue.setState({ pending: queue.length });
  if (handedOff.has(session)) {
    scheduleDrain();
    return;
  }
  try {
    commit({ session, sequence, event });
    mmkv.set(OUTBOX, JSON.stringify(readOutbox().filter((p) => p.session !== session || p.sequence !== sequence)));
    useArenaQueue.setState({ pending: readOutbox().length, error: null });
  } catch (error) {
    useArenaQueue.setState({ error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
export function handoffArenaRun(session: number) {
  handedOff.add(session);
  scheduleDrain();
}
export function arenaAward(session: number) {
  const run = readLedger().data.runs[session];
  return run?.finalSequence ? useAchievements.getState().arenaOutcomes[`${session}:${run.finalSequence}`] : undefined;
}
