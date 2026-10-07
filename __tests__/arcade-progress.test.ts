import { useArcadeProgress } from '../src/state/arcade';
import { mmkv } from '../src/state/storage';

beforeEach(() => useArcadeProgress.setState({ best: { pulse: 0, switch: 0, lock: 0 } }));

test('stores personal bests separately and never lowers them', () => {
  const { record } = useArcadeProgress.getState();
  record('pulse', 12);
  record('switch', 4);
  record('pulse', 3);
  expect(useArcadeProgress.getState().best).toEqual({ pulse: 12, switch: 4, lock: 0 });
  const saved = JSON.parse(mmkv.getString('lumo-arcade-v1')!);
  expect(saved.state.best).toEqual({ pulse: 12, switch: 4, lock: 0 });
});

test('invalid scores cannot poison persistent progress', () => {
  for (const score of [NaN, Infinity, -1, 0.5]) useArcadeProgress.getState().record('lock', score);
  expect(useArcadeProgress.getState().best.lock).toBe(0);
});

test('rehydrates personal bests from storage', async () => {
  mmkv.set('lumo-arcade-v1', JSON.stringify({ state: { best: { pulse: 8, switch: 3, lock: 7 } }, version: 0 }));
  await useArcadeProgress.persist.rehydrate();
  expect(useArcadeProgress.getState().best).toEqual({ pulse: 8, switch: 3, lock: 7 });
});
