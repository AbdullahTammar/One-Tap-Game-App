import { createChain, inputChain, stepChain } from './chain';
import { createDuel, inputDuel, stepDuel } from './duel';
import { createTilt, inputTilt, stepTilt } from './tilt';
export const DEFERRED_RULES = {
  chain: { create: createChain, step: stepChain, input: inputChain },
  duel: { create: createDuel, step: stepDuel, input: inputDuel },
  tilt: { create: createTilt, step: stepTilt, input: inputTilt },
};
export const DEFERRED_META = {
  duel: {
    id: 'duel',
    name: 'Dot Duel',
    color: '#FF5E7E',
    tag: '2 PLAYERS · ONE PHONE',
    gesture: 'Two-finger duel',
    description: 'Face to face. First to five.',
    instruction:
      'Drag your paddle in your half and knock the puck into the other goal. Play a friend on the same phone, or the bot.',
    unit: 'goals',
    action: null,
  },
  chain: {
    id: 'chain',
    name: 'Dot Chain',
    color: '#FF8A4C',
    tag: 'ONE SPARK',
    gesture: 'One tap',
    description: 'One spark. Make it count.',
    instruction: 'Tap once to spark a blast. Every dot it touches explodes too. Pop enough to clear the level.',
    unit: 'popped',
    action: null,
  },
  tilt: {
    id: 'tilt',
    name: 'Dot Maze',
    color: '#C8F560',
    tag: 'TILT',
    gesture: 'Tilt',
    description: 'Roll out of the spinning maze.',
    instruction: 'Tilt your phone to roll through the gaps and escape. You can also drag to pull the orb.',
    unit: 'escapes',
    action: null,
  },
} as const;
