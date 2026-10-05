import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useFrameCallback,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { GAME } from './constants';
import {
  continueRun as continueEngine,
  createGame,
  pause as pauseEngine,
  step,
  tap as tapEngine,
  type GameEvent,
  type GameState,
} from './engine';

export interface GameFx {
  /** 0 -> 1 shockwave progress after a hit. */
  pulse: SharedValue<number>;
  pulseAngle: SharedValue<number>;
  /** Horizontal shake offset on a miss. */
  shake: SharedValue<number>;
  /** Score "pop" scale. */
  scoreScale: SharedValue<number>;
}

export interface GameEngine {
  state: SharedValue<GameState>;
  fx: GameFx;
  gesture: ReturnType<typeof Gesture.Tap>;
  tap: () => void;
  pause: () => void;
  reset: () => void;
  continueRun: () => void;
}

function shakeAnimation() {
  'worklet';
  return withSequence(
    withTiming(-12, { duration: 50 }),
    withTiming(12, { duration: 50 }),
    withTiming(-7, { duration: 50 }),
    withTiming(0, { duration: 50 }),
  );
}

const newSeed = () => (Math.random() * 0x7fffffff) | 0;

/**
 * Wires the pure engine to the UI thread: a frame callback advances physics,
 * a touch-down gesture resolves taps, and events are forwarded to JS only when
 * something happens (start / hit / miss) — never per frame.
 */
export function useGameEngine(onEvent: (event: GameEvent, state: GameState) => void): GameEngine {
  const state = useSharedValue<GameState>(createGame(GAME.startSpeed, newSeed()));
  const pulse = useSharedValue(1);
  const pulseAngle = useSharedValue(0);
  const shake = useSharedValue(0);
  const scoreScale = useSharedValue(1);

  // Stable trampoline so worklets never capture a stale handler.
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((event: GameEvent, s: GameState) => handlerRef.current(event, s), []);

  useFrameCallback((frame) => {
    'worklet';
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    const prev = state.get();
    const { state: next, event } = step(prev, dt);
    if (next !== prev) state.set(next);
    if (event) {
      shake.set(shakeAnimation());
      scheduleOnRN(emit, event, next);
    }
  });

  const tapWorklet = useCallback(() => {
    'worklet';
    const prev = state.get();
    const { state: next, event } = tapEngine(prev);
    if (!event) return;
    state.set(next);
    if (event.type === 'hit') {
      pulseAngle.set(prev.angle);
      pulse.set(0);
      pulse.set(withTiming(1, { duration: 420 }));
      scoreScale.set(withSequence(withTiming(1.14, { duration: 70 }), withSpring(1, { damping: 12, stiffness: 300 })));
    } else if (event.type === 'miss') {
      shake.set(shakeAnimation());
    }
    scheduleOnRN(emit, event, next);
  }, [emit, pulse, pulseAngle, scoreScale, shake, state]);

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(60_000)
        .shouldCancelWhenOutside(false)
        // Resolve on touch-DOWN: waiting for release adds ~80ms of perceived lag.
        // onBegin only registers the worklet; nothing reads the ref during render.
        // eslint-disable-next-line react-hooks/refs
        .onBegin(() => {
          'worklet';
          tapWorklet();
        }),
    [tapWorklet],
  );

  const tap = useCallback(() => scheduleOnUI(tapWorklet), [tapWorklet]);

  const pause = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      state.set(pauseEngine(state.get()));
    });
  }, [state]);

  const reset = useCallback(() => {
    const seed = newSeed();
    scheduleOnUI(() => {
      'worklet';
      state.set(createGame(GAME.startSpeed, seed));
      pulse.set(1);
    });
  }, [pulse, state]);

  const continueRun = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      state.set(continueEngine(state.get()));
    });
  }, [state]);

  return { state, fx: { pulse, pulseAngle, shake, scoreScale }, gesture, tap, pause, reset, continueRun };
}
