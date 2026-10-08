import { createArena, inputArena, stepArena, type ArenaState } from './arena';
import { createChain, inputChain, stepChain, type ChainState } from './chain';
import { createCharge, inputCharge, stepCharge, type ChargeState } from './charge';
import type { MotionInput } from './common';
import { createDrift, inputDrift, stepDrift, type DriftState } from './drift';
import { createFlow, inputFlow, stepFlow, type FlowState } from './flow';
import { createSwipe, inputSwipe, stepSwipe, type SwipeState } from './swipe';
import { createTilt, inputTilt, stepTilt, type TiltState } from './tilt';

export const MOTION_GAMES = [
  {
    id: 'arena',
    name: 'Orb Arena',
    color: '#4CE0B3',
    tag: 'BATTLE ARENA',
    gesture: 'Joystick + dash',
    description: 'Eat, grow, outlast the storm.',
    instruction: 'Drag anywhere to steer. Swallow smaller orbs, dodge bigger ones, and stay inside the zone.',
    unit: 'mass',
    action: 'Dash',
  },
  {
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
    id: 'charge',
    name: 'Charge Shot',
    color: '#FF5E7E',
    tag: 'HOLD & RELEASE',
    gesture: 'Hold',
    description: 'Hold to power up. Let go to fly.',
    instruction: 'Hold to charge, release to jump to the next pad. Hold too long and you burn out.',
    unit: 'pads',
    action: null,
  },
  {
    id: 'swipe',
    name: 'Swipe Split',
    color: '#5AC8FA',
    tag: 'SWIPE',
    gesture: 'Swipe',
    description: 'Every color has a gate.',
    instruction: 'Swipe the dot toward the gate of the same color. Watch for dots that change color.',
    unit: 'sorts',
    action: null,
  },
  {
    id: 'chain',
    name: 'Chain Reaction',
    color: '#FF8A4C',
    tag: 'ONE SPARK',
    gesture: 'One tap',
    description: 'One spark. Make it count.',
    instruction: 'Tap once to spark a blast. Every dot it touches explodes too. Pop enough to clear the level.',
    unit: 'popped',
    action: null,
  },
  {
    id: 'flow',
    name: 'Connect Flow',
    color: '#B48CFF',
    tag: 'DRAW',
    gesture: 'Draw',
    description: 'Link the colors. Close the loop.',
    instruction: 'Draw a line through same-color dots. Close a loop to clear every dot of that color.',
    unit: 'dots',
    action: null,
  },
  {
    id: 'tilt',
    name: 'Tilt Orb',
    color: '#C8F560',
    tag: 'TILT',
    gesture: 'Tilt',
    description: 'Roll out of the spinning maze.',
    instruction: 'Tilt your phone to roll through the gaps and escape. You can also drag to pull the orb.',
    unit: 'escapes',
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
}
export type AnyMotion = MotionStates[MotionId];

interface Rules<S> {
  create: (seed: number) => S;
  step: (s: S, dt: number) => S;
  input: (s: S, ev: MotionInput) => S;
}
export const MOTION_RULES: { [K in MotionId]: Rules<MotionStates[K]> } = {
  arena: { create: createArena, step: stepArena, input: inputArena },
  drift: { create: createDrift, step: stepDrift, input: inputDrift },
  charge: { create: createCharge, step: stepCharge, input: inputCharge },
  swipe: { create: createSwipe, step: stepSwipe, input: inputSwipe },
  chain: { create: createChain, step: stepChain, input: inputChain },
  flow: { create: createFlow, step: stepFlow, input: inputFlow },
  tilt: { create: createTilt, step: stepTilt, input: inputTilt },
};
// Erases the per-game generic so screens can hold any game's state.
const rules = MOTION_RULES as unknown as Record<MotionId, Rules<AnyMotion>>;
export const createMotion = (id: MotionId, seed: number) => rules[id].create(seed);
export const stepMotion = (id: MotionId, s: AnyMotion, dt: number) => rules[id].step(s, dt);
export const inputMotion = (id: MotionId, s: AnyMotion, ev: MotionInput) => rules[id].input(s, ev);
export function isMotionId(id: unknown): id is MotionId {
  return MOTION_GAMES.some((g) => g.id === id);
}
export type { MotionInput } from './common';
