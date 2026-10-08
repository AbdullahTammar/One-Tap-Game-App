import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import {
  createClock,
  DEFAULT_CLOCK,
  pauseClock,
  planFrame,
  resetClock,
  resumeClock,
  validateClock,
  type ClockConfig,
} from './clock';
import {
  acknowledgeBatch,
  beginSession,
  createEventBus,
  createEventReceiver,
  hasEventRoom,
  takeBatch,
  type DiscreteEvent,
  type EventBus,
} from './events';
import { clearInput, type InputState } from './input';
import type { Probe } from './probe';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- prune the entire probe module in release bundles
const devProbe: typeof import('./probe') | null = __DEV__ ? require('./probe') : null;
const sampleDevFrame = __DEV__ ? devProbe?.sampleFrame : null;

/** All methods are pure worklets; step mutates only preallocated state/input/journal. ZERO FRAME-DRIVEN React renders. */
export interface WorkletEngine<S> {
  create: () => S;
  reset: (state: S) => void;
  step: (state: S, input: InputState, dt: number, tick: number, events: EventBus) => void;
  maxEventsPerStep: number;
}
export function useFixedEngine<S>(
  engine: WorkletEngine<S>,
  input: SharedValue<InputState>,
  onEvent: (event: DiscreteEvent, session: number, sequence: number) => void,
  config: ClockConfig = DEFAULT_CLOCK,
) {
  validateClock(config);
  if (
    !Number.isSafeInteger(engine.maxEventsPerStep) ||
    engine.maxEventsPerStep < 1 ||
    engine.maxEventsPerStep * config.maxSubsteps > 256
  )
    throw new Error('Engine frame event budget exceeds journal capacity');
  const create = engine.create;
  const initialState = useMemo(() => create(), [create]);
  const initialClock = useMemo(() => createClock(), []);
  const initialEvents = useMemo(() => createEventBus(), []);
  const state = useSharedValue(initialState);
  const clock = useSharedValue(initialClock);
  const events = useSharedValue(initialEvents);
  const alpha = useSharedValue(0);
  const running = useSharedValue(false);
  const foreground = useSharedValue(AppState.currentState === 'active');
  const blocked = useSharedValue(false);
  const planned = useSharedValue(0);
  const deliveryError = useSharedValue(false);
  const pendingEvents = useSharedValue(0);
  // Production initialization allocates no probe sample buffers.
  const initialProbe = useMemo<Probe | null>(() => (__DEV__ && devProbe ? devProbe.createProbe() : null), []);
  const probe = useSharedValue(initialProbe);
  const probeEnabled = useSharedValue(false);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);
  const dispatchEvent = useCallback(
    (event: DiscreteEvent, session: number, sequence: number) => handler.current(event, session, sequence),
    [],
  );
  // Factory only stores dispatchEvent; it does not read the ref until RN receives a batch.
  // eslint-disable-next-line react-hooks/refs
  const receiver = useMemo(() => createEventReceiver(dispatchEvent), [dispatchEvent]);
  const receive = useCallback(
    (batch: number[]) => {
      try {
        const sequence = receiver(batch);
        scheduleOnUI(() => {
          'worklet';
          events.modify((b) => {
            'worklet';
            acknowledgeBatch(b, sequence);
            pendingEvents.set(b.journal.count);
            return b;
          });
        });
      } catch {
        // Retain the journal and stop physics; caller repairs handler then explicitly retries.
        scheduleOnUI(() => {
          'worklet';
          deliveryError.set(true);
          pauseClock(clock.get());
          running.set(false);
          alpha.set(0);
          clearInput(input.get());
        });
      }
    },
    [alpha, clock, deliveryError, events, input, pendingEvents, receiver, running],
  );
  const { step, reset: resetState, maxEventsPerStep } = engine;
  const stepSeconds = config.step,
    maxDelta = config.maxDelta,
    maxSubsteps = config.maxSubsteps;
  // Capture a tiny stable config, rather than the engine/route object.
  const fixedConfig = useMemo(
    () => ({ step: stepSeconds, maxDelta, maxSubsteps }),
    [stepSeconds, maxDelta, maxSubsteps],
  );
  const advance = useCallback(
    (s: S) => {
      'worklet';
      const c = clock.get(),
        bus = events.get(),
        controls = input.get();
      for (let i = 0; i < planned.get() && !bus.terminal; i++) {
        step(s, controls, fixedConfig.step, c.tick, bus);
        c.tick++;
        controls.down = 0;
        controls.up = 0;
        controls.cancelled = false;
      }
      return s;
    },
    [clock, events, fixedConfig, input, planned, step],
  );
  useFrameCallback((frame) => {
    'worklet';
    const c = clock.get(),
      bus = events.get();
    if (__DEV__ && probeEnabled.get() && running.get() && !c.fresh) {
      const p = probe.get();
      if (p && sampleDevFrame) sampleDevFrame(p, frame.timeSincePreviousFrame ?? 0);
    }
    if (running.get() && !deliveryError.get()) {
      const room = hasEventRoom(bus, maxEventsPerStep * fixedConfig.maxSubsteps);
      blocked.set(!room);
      if (room) {
        const count = planFrame(c, (frame.timeSincePreviousFrame ?? 0) / 1000, fixedConfig);
        planned.set(count);
        if (count > 0) state.modify(advance);
        if (bus.terminal) {
          pauseClock(c);
          running.set(false);
          clearInput(input.get());
        }
      } else {
        c.accumulator = 0;
        c.alpha = 0;
        c.fresh = true;
      }
      alpha.set(c.alpha);
    }
    const batch = takeBatch(bus);
    pendingEvents.set(bus.journal.count);
    if (batch) scheduleOnRN(receive, batch);
  });
  const pause = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        pauseClock(clock.get());
        running.set(false);
        alpha.set(0);
        clearInput(input.get());
      }),
    [alpha, clock, input, running],
  );
  const resume = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        if (!foreground.get() || events.get().terminal || deliveryError.get()) return;
        resumeClock(clock.get());
        running.set(true);
      }),
    [clock, deliveryError, events, foreground, running],
  );
  const reset = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        resetClock(clock.get());
        running.set(false);
        alpha.set(0);
        clearInput(input.get());
        state.modify((s) => {
          'worklet';
          resetState(s);
          return s;
        });
        beginSession(events.get());
      }),
    [alpha, clock, events, input, resetState, running, state],
  );
  const retryEvents = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        events.get().retry = true;
        deliveryError.set(false);
      }),
    [deliveryError, events],
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      scheduleOnUI(() => {
        'worklet';
        foreground.set(status === 'active');
      });
      if (status !== 'active') pause();
    });
    return () => {
      sub.remove();
      pause();
    };
  }, [foreground, pause]);
  return {
    state,
    alpha,
    running,
    blocked,
    deliveryError,
    pendingEvents,
    pause,
    resume,
    reset,
    retryEvents,
    probe,
    probeEnabled,
  };
}
