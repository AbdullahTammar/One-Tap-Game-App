import { flagEmoji, MYSTERY_PRICE, mysteryPick, SKIN_CATEGORIES, SKINS } from '../src/game/skins';
import { initialProgress } from '../src/state/progress';
import { buyMystery } from '../src/state/progressLogic';

test('skin ids are unique and every category has skins', () => {
  expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
  for (const c of SKIN_CATEGORIES) expect(SKINS.some((s) => s.category === c)).toBe(true);
  expect(SKINS.every((s) => s.price >= 0 && /^#[0-9A-F]{6}$/i.test(s.fill))).toBe(true);
});

test('flag emoji are built from country codes', () => {
  expect(flagEmoji('SA')).toBe('🇸🇦');
  expect(SKINS.find((s) => s.id === 'flag-sa')?.emoji).toBe('🇸🇦');
});

test('mystery box grants a locked fun skin, never a flag, and charges once', () => {
  const p = { ...initialProgress, coins: MYSTERY_PRICE + 5 };
  const { next, skin } = buyMystery(p, 0.5);
  expect(skin?.emoji).toBeTruthy();
  expect(skin?.category).not.toBe('Flags');
  expect(next).toMatchObject({ coins: 5, equipped: skin!.id });
  expect(next.owned).toContain(skin!.id);
  expect(buyMystery({ ...p, coins: MYSTERY_PRICE - 1 }, 0.5).skin).toBeNull();
  const everything = SKINS.map((s) => s.id);
  expect(mysteryPick(everything, 0.3)).toBeNull();
  expect(mysteryPick([], 0.999999)).not.toBeNull();
});
