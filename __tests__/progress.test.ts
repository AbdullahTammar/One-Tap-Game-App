import { ECONOMY } from '../src/game/constants';
import { rankFor, RANKS } from '../src/game/ranks';
import { nextUnlock, SKINS } from '../src/game/skins';
import { initialProgress } from '../src/state/progress';
import { amendRun, applyRun, coinsForRun, liveStreak, selectSkin, type ProgressData } from '../src/state/progressLogic';
import { dayKey, daysBetween, formatNumber } from '../src/utils/date';

const at = (iso: string) => new Date(`${iso}T12:00:00`);
const base = (): ProgressData => ({ ...initialProgress, coins: 0 });

describe('economy', () => {
  it('awards half a coin per gate, as in the design (42 -> 21)', () => {
    expect(coinsForRun(42, 0)).toBe(21);
    expect(coinsForRun(1, 0)).toBe(0);
  });
});

describe('applyRun', () => {
  it('records best, totals, coins and top runs', () => {
    const { next, outcome } = applyRun(base(), { score: 42, perfects: 5, topSpeed: 2.1 }, at('2026-10-05'));
    expect(next.best).toBe(42);
    expect(next.totalGames).toBe(1);
    expect(next.totalGates).toBe(42);
    expect(next.coins).toBe(21 + ECONOMY.dailyGoalReward);
    expect(outcome).toMatchObject({
      coinsEarned: 21,
      dailyBonus: ECONOMY.dailyGoalReward,
      newBest: true,
      previousBest: 0,
    });
    expect(next.topRuns).toHaveLength(1);
  });

  it('pays the daily goal once per day and resets the next day', () => {
    let p = base();
    p = applyRun(p, { score: 20, perfects: 0, topSpeed: 1 }, at('2026-10-05')).next;
    expect(p.dailyClaimed).toBe(false);
    const second = applyRun(p, { score: 15, perfects: 0, topSpeed: 1 }, at('2026-10-05'));
    expect(second.outcome.dailyBonus).toBe(ECONOMY.dailyGoalReward);
    const third = applyRun(second.next, { score: 40, perfects: 0, topSpeed: 1 }, at('2026-10-05'));
    expect(third.outcome.dailyBonus).toBe(0);
    const tomorrow = applyRun(third.next, { score: 5, perfects: 0, topSpeed: 1 }, at('2026-10-06'));
    expect(tomorrow.next.dailyGates).toBe(5);
    expect(tomorrow.next.dailyClaimed).toBe(false);
  });

  it('builds and breaks streaks', () => {
    let p = base();
    p = applyRun(p, { score: 1, perfects: 0, topSpeed: 1 }, at('2026-10-01')).next;
    p = applyRun(p, { score: 1, perfects: 0, topSpeed: 1 }, at('2026-10-01')).next;
    expect(p.streak).toBe(1);
    p = applyRun(p, { score: 1, perfects: 0, topSpeed: 1 }, at('2026-10-02')).next;
    expect(p.streak).toBe(2);
    expect(liveStreak(p, '2026-10-03')).toBe(2);
    expect(liveStreak(p, '2026-10-04')).toBe(0);
    p = applyRun(p, { score: 1, perfects: 0, topSpeed: 1 }, at('2026-10-05')).next;
    expect(p.streak).toBe(1);
  });

  it('keeps only the top 10 runs, best first', () => {
    let p = base();
    for (let i = 1; i <= 15; i++) p = applyRun(p, { score: i, perfects: 0, topSpeed: 1 }, at('2026-10-05')).next;
    expect(p.topRuns.map((r) => r.score)).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7, 6]);
  });

  it('doubles coins after a rewarded ad', () => {
    const { outcome } = applyRun(base(), { score: 10, perfects: 0, topSpeed: 1, doubled: true });
    expect(outcome.coinsEarned).toBe(10);
  });
});

describe('amendRun (continued runs)', () => {
  it('replaces the original record without counting a new game or double-paying', () => {
    const first = applyRun(
      { ...base(), best: 30, dailyDay: '2026-10-05', dailyClaimed: true },
      { score: 20, perfects: 1, topSpeed: 1.5 },
      at('2026-10-05'),
    );
    const original = { at: first.outcome.at, score: 20, perfects: 1, coinsEarned: first.outcome.coinsEarned };
    const { next, outcome } = amendRun(first.next, original, { score: 35, perfects: 3, topSpeed: 2 });
    expect(next.totalGames).toBe(1);
    expect(next.totalGates).toBe(35);
    expect(next.totalPerfects).toBe(3);
    expect(next.coins).toBe(first.next.coins + (coinsForRun(35, 3) - coinsForRun(20, 1)));
    expect(outcome.coinsEarned).toBe(coinsForRun(35, 3));
    expect(next.topRuns).toHaveLength(1);
    expect(next.topRuns[0].score).toBe(35);
    expect(next.best).toBe(35);
  });

  it('reports a new best against the pre-run best', () => {
    const p = applyRun(base(), { score: 10, perfects: 0, topSpeed: 1 }, at('2026-10-04')).next;
    const first = applyRun(p, { score: 12, perfects: 0, topSpeed: 1 }, at('2026-10-05'));
    const original = { at: first.outcome.at, score: 12, perfects: 0, coinsEarned: first.outcome.coinsEarned };
    const { outcome } = amendRun(first.next, original, { score: 14, perfects: 0, topSpeed: 1 });
    expect(outcome.previousBest).toBe(10);
    expect(outcome.newBest).toBe(true);
  });
});

describe('skins', () => {
  it('equips owned skins and unlocks affordable ones', () => {
    const p = { ...base(), coins: 500 };
    expect(selectSkin(p, 'volt')).toMatchObject({ action: 'equipped', next: { equipped: 'volt' } });
    const u = selectSkin(p, 'mint');
    expect(u.action).toBe('unlocked');
    expect(u.next.coins).toBe(100);
    expect(u.next.owned).toContain('mint');
    expect(selectSkin(p, 'gold').action).toBe('insufficient');
    expect(selectSkin(p, 'classic').action).toBe('noop');
    expect(selectSkin(p, 'not-a-skin').action).toBe('noop');
  });

  it('next unlock is the cheapest locked skin', () => {
    expect(nextUnlock(['classic', 'volt', 'tide'])?.id).toBe('mint');
    expect(nextUnlock(SKINS.map((s) => s.id))).toBeNull();
  });
});

describe('ranks', () => {
  it('maps best score to a tier with progress', () => {
    expect(rankFor(0).tier.id).toBe('spark');
    const r = rankFor(30);
    expect(r.tier.id).toBe('flare');
    expect(r.next?.id).toBe('comet');
    expect(r.progress).toBeCloseTo(0.2);
    expect(rankFor(10_000)).toMatchObject({ tier: RANKS[RANKS.length - 1], next: null, progress: 1 });
  });
});

describe('date utils', () => {
  it('formats keys and counts days across month/DST boundaries', () => {
    expect(dayKey(at('2026-03-09'))).toBe('2026-03-09');
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(formatNumber(1240)).toBe('1,240');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
