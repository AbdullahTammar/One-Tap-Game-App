/** Expo inlines these dot-notation reads at build time. The development override never enables release code. */
export const DEFERRED_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_DEFERRED_GAMES === '1' ||
  (__DEV__ && process.env.EXPO_PUBLIC_DEV_DEFERRED_GAMES === '1');
export const GAME_AVAILABILITY = {
  runner: true,
  pulse: true,
  switch: true,
  lock: true,
  arena: true,
  paint: true,
  drift: true,
  charge: true,
  swipe: true,
  flow: true,
  stack: true,
  duel: DEFERRED_ENABLED,
  chain: DEFERRED_ENABLED,
  tilt: DEFERRED_ENABLED,
};
export type Availability = typeof GAME_AVAILABILITY;
export function enabledGameIds(flags: Availability = GAME_AVAILABILITY) {
  return Object.keys(flags).filter((id) => flags[id as keyof Availability]);
}
export function gameEnabled(id: unknown, flags: Availability = GAME_AVAILABILITY): boolean {
  return typeof id === 'string' && flags[id as keyof Availability] === true;
}
export const PLAYER_GAME_COUNT = enabledGameIds().length;
