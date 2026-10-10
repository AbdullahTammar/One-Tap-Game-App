/* eslint-disable @typescript-eslint/no-require-imports -- build-time conditional requires exclude deferred modules */
import type { ChainState } from './chain';
import type { DuelState } from './duel';
import type { TiltState } from './tilt';
import { DEFERRED_ENABLED } from '../availability';
import { createArena, inputArena, stepArena, type ArenaState } from './arena';
import { createCharge, inputCharge, stepCharge, type ChargeState } from './charge';
import type { MotionInput } from './common';
import { createDrift, inputDrift, stepDrift, type DriftState } from './drift';
import { createFlow, inputFlow, stepFlow, type FlowState } from './flow';
import { createPaint, inputPaint, stepPaint, type PaintState } from './paint';
import { createStack, inputStack, stepStack, type StackState } from './stack';
import { createSwipe, inputSwipe, stepSwipe, type SwipeState } from './swipe';

// Conditional requires are intentional: release Metro must not include deferred rules/resources.
const deferred =
  process.env.EXPO_PUBLIC_ENABLE_DEFERRED_GAMES === '1' ||
  (__DEV__ && process.env.EXPO_PUBLIC_DEV_DEFERRED_GAMES === '1') ||
  process.env.NODE_ENV === 'test'
    ? (require('./deferred') as typeof import('./deferred'))
    : null;
const deferredRules = deferred?.DEFERRED_RULES,
  deferredMeta = deferred?.DEFERRED_META;
const emptyMeta = {
  name: '',
  color: '',
  tag: '',
  gesture: '',
  description: '',
  instruction: '',
  unit: '',
  action: null,
};
const unavailable = {
  create: () => {
    throw new Error('Game disabled');
  },
  step: <T>(s: T) => s,
  input: <T>(s: T) => s,
};
export const MOTION_GAMES = [
  {
    enabled: true,
    id: 'arena',
    name: 'Dot Arena',
    color: '#4CE0B3',
    tag: 'BATTLE · ONLINE-READY',
    gesture: 'Joystick + dash',
    description: 'Eat, grow, outlast the storm.',
    instruction: 'Drag anywhere to steer. Swallow smaller orbs, dodge bigger ones, and stay inside the zone.',
    unit: 'mass',
    action: 'Dash',
  },
  {
    enabled: true,
    id: 'paint',
    name: 'Dot Paint',
    color: '#FF7AD9',
    tag: 'TERRITORY · ONLINE-READY',
    gesture: 'Swipe to steer',
    description: 'Paint the map. Cut their trails.',
    instruction:
      'Swipe to turn. Leave your land to draw a trail, then return to claim the area. Cross a rival trail to knock them out.',
    unit: '% land',
    action: null,
  },
  { id: 'duel', ...emptyMeta, ...deferredMeta?.duel, enabled: DEFERRED_ENABLED }, // TODO(deferred): docs/DEFERRED_GAMES.md

  {
    enabled: true,
    id: 'drift',
    name: 'Dot Drift',
    color: '#FFC94D',
    tag: 'DRAG',
    gesture: 'Drag',
    description: 'Slide through the swarm. Chain the gold.',
    instruction: 'Drag anywhere to slide your dot. Grab gold fast to build a combo.',
    unit: 'points',
    action: null,
  },
  {
    enabled: true,
    id: 'charge',
    name: 'Dot Jump',
    color: '#FF5E7E',
    tag: 'HOLD & RELEASE',
    gesture: 'Hold',
    description: 'Hold to power up. Let go to fly.',
    instruction: 'Hold to charge, release to jump to the next pad. Hold too long and you burn out.',
    unit: 'pads',
    action: null,
  },
  {
    enabled: true,
    id: 'swipe',
    name: 'Dot Sort',
    color: '#5AC8FA',
    tag: 'SWIPE',
    gesture: 'Swipe',
    description: 'Every color has a gate.',
    instruction: 'Swipe the dot toward the gate of the same color. Watch for dots that change color.',
    unit: 'sorts',
    action: null,
  },
  { id: 'chain', ...emptyMeta, ...deferredMeta?.chain, enabled: DEFERRED_ENABLED }, // TODO(deferred): docs/DEFERRED_GAMES.md

  {
    enabled: true,
    id: 'flow',
    name: 'Dot Link',
    color: '#B48CFF',
    tag: 'DRAW',
    gesture: 'Draw',
    description: 'Link the colors. Close the loop.',
    instruction: 'Draw a line through same-color dots. Close a loop to clear every dot of that color.',
    unit: 'dots',
    action: null,
  },
  { id: 'tilt', ...emptyMeta, ...deferredMeta?.tilt, enabled: DEFERRED_ENABLED }, // TODO(deferred): docs/DEFERRED_GAMES.md

  {
    enabled: true,
    id: 'stack',
    name: 'Dot Stack',
    color: '#7A9CFF',
    tag: 'HOLD & DARE',
    gesture: 'Hold',
    description: 'Grow it close. Never touch.',
    instruction:
      'Hold to grow a ring, release to lock it inside the last one. The closer you dare, the more you score.',
    unit: 'points',
    action: null,
  },
] as const;
export type MotionId = (typeof MOTION_GAMES)[number]['id'];
export type MotionMeta = (typeof MOTION_GAMES)[number];
export interface MotionStates {
  arena: ArenaState;
  drift: DriftState;
  charge: ChargeState;
  swipe: SwipeState;
  chain: ChainState;
  flow: FlowState;
  tilt: TiltState;
  stack: StackState;
  duel: DuelState;
  paint: PaintState;
}
export type AnyMotion = MotionStates[MotionId];

interface Rules<S> {
  create: (seed: number, playerName?: string) => S;
  step: (s: S, dt: number) => S;
  input: (s: S, ev: MotionInput) => S;
}
export const MOTION_RULES: { [K in MotionId]: Rules<MotionStates[K]> } = {
  arena: { create: createArena, step: stepArena, input: inputArena },
  drift: { create: createDrift, step: stepDrift, input: inputDrift },
  charge: { create: createCharge, step: stepCharge, input: inputCharge },
  swipe: { create: createSwipe, step: stepSwipe, input: inputSwipe },
  chain: deferredRules?.chain ?? unavailable,
  flow: { create: createFlow, step: stepFlow, input: inputFlow },
  tilt: deferredRules?.tilt ?? unavailable,
  stack: { create: createStack, step: stepStack, input: inputStack },
  duel: deferredRules?.duel ?? unavailable,
  paint: { create: createPaint, step: stepPaint, input: inputPaint },
};
// Erases the per-game generic so screens can hold any game's state.
const rules = MOTION_RULES as unknown as Record<MotionId, Rules<AnyMotion>>;
export const createMotion = (id: MotionId, seed: number, playerName?: string) => rules[id].create(seed, playerName);
export const stepMotion = (id: MotionId, s: AnyMotion, dt: number) => rules[id].step(s, dt);
export const inputMotion = (id: MotionId, s: AnyMotion, ev: MotionInput) => rules[id].input(s, ev);
export function isMotionId(id: unknown): id is MotionId {
  return MOTION_GAMES.some((g) => g.id === id);
}
export type { MotionInput } from './common';
