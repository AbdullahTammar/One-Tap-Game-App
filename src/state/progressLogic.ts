/**
 * Pure progression rules (no React, no storage) so they are trivially testable.
 */
import { ECONOMY } from '../game/constants';
import { getSkin, MYSTERY_PRICE, mysteryPick, type Skin } from '../game/skins';
import { dayKey, daysBetween } from '../utils/date';

export interface RunRecord {
  score: number;
  perfects: number;
  topSpeed: number;
  at: number;
}

export interface ProgressData {
  coins: number;
  best: number;
  totalGames: number;
  totalGates: number;
  totalPerfects: number;
  owned: string[];
  equipped: string;
  streak: number;
  lastPlayDay: string | null;
  dailyDay: string | null;
  dailyGates: number;
  dailyClaimed: boolean;
  topRuns: RunRecord[];
}

export interface RunInput {
  score: number;
  perfects: number;
  /** Multiplier vs. start speed, e.g. 2.1. */
  topSpeed: number;
  /** When true (rewarded ad), coins earned are doubled. */
  doubled?: boolean;
}

export interface RunOutcome {
  /** Record timestamp — the key used to amend this run if it is continued. */
  at: number;
  coinsEarned: number;
  dailyBonus: number;
  newBest: boolean;
  previousBest: number;
}

export function coinsForRun(score: number, perfects: number): number {
  return Math.floor(score * ECONOMY.coinsPerGate + perfects * ECONOMY.coinsPerPerfect);
}

/** Roll the daily counters / streak forward to `today`. */
export function rollDay(p: ProgressData, today: string): ProgressData {
  if (p.dailyDay === today) return p;
  return { ...p, dailyDay: today, dailyGates: 0, dailyClaimed: false };
}

/** Streak as it should be displayed today (broken streaks read as 0). */
export function liveStreak(p: ProgressData, today: string = dayKey()): number {
  if (!p.lastPlayDay) return 0;
  return daysBetween(p.lastPlayDay, today) <= 1 ? p.streak : 0;
}

export function applyRun(
  prev: ProgressData,
  run: RunInput,
  now: Date = new Date(),
): { next: ProgressData; outcome: RunOutcome } {
  const today = dayKey(now);
  const p = rollDay(prev, today);

  let streak = p.streak;
  if (p.lastPlayDay !== today) {
    const gap = p.lastPlayDay ? daysBetween(p.lastPlayDay, today) : Infinity;
    streak = gap === 1 ? streak + 1 : 1;
  }

  const base = coinsForRun(run.score, run.perfects);
  const coinsEarned = run.doubled ? base * 2 : base;
  const dailyGates = p.dailyGates + run.score;
  const reachedGoal = !p.dailyClaimed && dailyGates >= ECONOMY.dailyGoalGates;
  const dailyBonus = reachedGoal ? ECONOMY.dailyGoalReward : 0;

  const record: RunRecord = {
    score: run.score,
    perfects: run.perfects,
    topSpeed: run.topSpeed,
    at: now.getTime(),
  };
  const topRuns = [...p.topRuns, record].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);

  const next: ProgressData = {
    ...p,
    coins: p.coins + coinsEarned + dailyBonus,
    best: Math.max(p.best, run.score),
    totalGames: p.totalGames + 1,
    totalGates: p.totalGates + run.score,
    totalPerfects: p.totalPerfects + run.perfects,
    streak,
    lastPlayDay: today,
    dailyGates,
    dailyClaimed: p.dailyClaimed || reachedGoal,
    topRuns,
  };
  return {
    next,
    outcome: { at: record.at, coinsEarned, dailyBonus, newBest: run.score > p.best, previousBest: p.best },
  };
}

/**
 * A continued run (rewarded ad) ends a second time: replace the first record
 * instead of counting a new game, and credit only the extra gates/coins.
 */
export function amendRun(
  prev: ProgressData,
  original: { at: number; score: number; perfects: number; coinsEarned: number },
  run: RunInput,
): { next: ProgressData; outcome: RunOutcome } {
  const extraGates = Math.max(0, run.score - original.score);
  const extraPerfects = Math.max(0, run.perfects - original.perfects);
  const coinsTotal = coinsForRun(run.score, run.perfects) * (run.doubled ? 2 : 1);
  const coinsEarned = Math.max(0, coinsTotal - original.coinsEarned);
  const dailyGates = prev.dailyGates + extraGates;
  const reachedGoal = !prev.dailyClaimed && dailyGates >= ECONOMY.dailyGoalGates;
  const dailyBonus = reachedGoal ? ECONOMY.dailyGoalReward : 0;
  // `prev.best` may already include the first segment; compare to the pre-run best.
  const previousBest = prev.topRuns.filter((r) => r.at !== original.at).reduce((m, r) => Math.max(m, r.score), 0);
  const record: RunRecord = { score: run.score, perfects: run.perfects, topSpeed: run.topSpeed, at: original.at };
  const topRuns = [...prev.topRuns.filter((r) => r.at !== original.at), record]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, 10);
  const next: ProgressData = {
    ...prev,
    coins: prev.coins + coinsEarned + dailyBonus,
    best: Math.max(prev.best, run.score),
    totalGates: prev.totalGates + extraGates,
    totalPerfects: prev.totalPerfects + extraPerfects,
    dailyGates,
    dailyClaimed: prev.dailyClaimed || reachedGoal,
    topRuns,
  };
  return {
    next,
    outcome: {
      at: original.at,
      coinsEarned: original.coinsEarned + coinsEarned,
      dailyBonus,
      newBest: run.score > previousBest,
      previousBest,
    },
  };
}

export type SkinAction = 'equipped' | 'unlocked' | 'insufficient' | 'noop';

export function selectSkin(p: ProgressData, id: string): { next: ProgressData; action: SkinAction } {
  const skin = getSkin(id);
  if (skin.id !== id) return { next: p, action: 'noop' };
  if (p.owned.includes(id)) {
    if (p.equipped === id) return { next: p, action: 'noop' };
    return { next: { ...p, equipped: id }, action: 'equipped' };
  }
  if (p.coins < skin.price) return { next: p, action: 'insufficient' };
  return {
    next: { ...p, coins: p.coins - skin.price, owned: [...p.owned, id], equipped: id },
    action: 'unlocked',
  };
}

/** Spends the mystery price on a random locked skin and equips it. */
export function buyMystery(p: ProgressData, roll: number): { next: ProgressData; skin: Skin | null } {
  if (p.coins < MYSTERY_PRICE) return { next: p, skin: null };
  const skin = mysteryPick(p.owned, roll);
  if (!skin) return { next: p, skin: null };
  return {
    next: { ...p, coins: p.coins - MYSTERY_PRICE, owned: [...p.owned, skin.id], equipped: skin.id },
    skin,
  };
}
