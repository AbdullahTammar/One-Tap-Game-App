import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
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
import { createDeliveryController, type DeliveryFailure } from './delivery';
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

const DEV_MODE = __DEV__;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- prune the probe module in release bundles
const devProbe: typeof import('./probe') | null = __DEV__ ? require('./probe') : null;
const sampleDevFrame = DEV_MODE ? devProbe?.sampleFrame : null;

/** Pure worklet reset/step; mutate preallocated state/journal only. Zero frame-driven React renders. */
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
  initialSession = 1,
  probeCapacity = 600,
) {
  validateClock(config);
  if (
    !Number.isSafeInteger(engine.maxEventsPerStep) ||
    engine.maxEventsPerStep < 1 ||
    engine.maxEventsPerStep * config.maxSubsteps > 256
  )
    throw new Error('Engine frame event budget exceeds journal capacity');
  const { create, step, reset: resetState, maxEventsPerStep } = engine;
  const initialState = useMemo(() => create(), [create]);
  const initialClock = useMemo(() => createClock(), []);
  const initialEvents = useMemo(() => createEventBus(256, initialSession), [initialSession]);
  const initialProbe = useMemo<Probe | null>(() => (DEV_MODE && devProbe ? devProbe.createProbe(probeCapacity) : null), [probeCapacity]);
  const state = useSharedValue(initialState);
  const clock = useSharedValue(initialClock);
  const events = useSharedValue(initialEvents);
  const alpha = useSharedValue(0);
  const running = useSharedValue(false);
  const foreground = useSharedValue(AppState.currentState === 'active');
  const blocked = useSharedValue(false);
  const deliveryError = useSharedValue(false);
  const resumeAfterDelivery = useSharedValue(false);
  const pendingEvents = useSharedValue(0);
  const probe = useSharedValue(initialProbe);
  const probeEnabled = useSharedValue(false);
  const [deliveryFailure, setDeliveryFailure] = useState<DeliveryFailure | null>(null);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);
  const dispatchEvent = useCallback(
    (event: DiscreteEvent, session: number, sequence: number) => handler.current(event, session, sequence),
    [],
  );
  // Factory stores this callback; it only reads the handler ref when a packet arrives.
  // eslint-disable-next-line react-hooks/refs
  const receiver = useMemo(() => createEventReceiver(dispatchEvent), [dispatchEvent]);
  const succeeded = useCallback(
    (sequence: number) => {
      setDeliveryFailure(null);
      scheduleOnUI(() => {
        'worklet';
        events.modify((bus) => {
          'worklet';
          acknowledgeBatch(bus, sequence);
          pendingEvents.set(bus.journal.count);
          return bus;
        });
        const wasFailed = deliveryError.get();
        deliveryError.set(false);
        if (wasFailed && resumeAfterDelivery.get() && foreground.get() && !events.get().terminal) {
          clock.modify((c) => {
            'worklet';
            resumeClock(c);
            return c;
          });
          alpha.set(1);
          running.set(true);
        }
        resumeAfterDelivery.set(false);
      });
    },
    [alpha, clock, deliveryError, events, foreground, pendingEvents, resumeAfterDelivery, running],
  );
  const failed = useCallback(
    (error: unknown, failure: DeliveryFailure) => {
      if (DEV_MODE) console.error('[Game foundation] Event delivery failed', error);
      setDeliveryFailure(failure);
      scheduleOnUI(() => {
        'worklet';
        if (!deliveryError.get()) resumeAfterDelivery.set(running.get());
        deliveryError.set(true);
        clock.modify((c) => {
          'worklet';
          pauseClock(c);
          return c;
        });
        input.modify((controls) => {
          'worklet';
          clearInput(controls);
          return controls;
        });
        running.set(false);
        alpha.set(1);
      });
    },
    [alpha, clock, deliveryError, input, resumeAfterDelivery, running],
  );
  const controller = useMemo(
    () => createDeliveryController({ deliver: receiver, success: succeeded, failure: failed }),
    [failed, receiver, succeeded],
  );
  const receive = useCallback((batch: number[]) => controller.receive(batch), [controller]);
  const stepSeconds = config.step,
    maxDelta = config.maxDelta,
    maxSubsteps = config.maxSubsteps;
  const fixedConfig = useMemo(
    () => ({ step: stepSeconds, maxDelta, maxSubsteps }),
    [stepSeconds, maxDelta, maxSubsteps],
  );
  const frameCallback = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      if (!running.get() && pendingEvents.get() === 0) return;
      // Every object write is within its own shared value modifier. Only primitives use get/set.
      clock.modify((c) => {
        'worklet';
        if (DEV_MODE && probeEnabled.get() && running.get() && !c.fresh) {
          probe.modify((p) => {
            'worklet';
            if (p && sampleDevFrame) sampleDevFrame(p, frame.timeSincePreviousFrame ?? 0);
            return p;
          });
        }
        events.modify((bus) => {
          'worklet';
          if (running.get() && !deliveryError.get()) {
            const room = hasEventRoom(bus, maxEventsPerStep * fixedConfig.maxSubsteps);
            blocked.set(!room);
            if (room) {
              const count = planFrame(c, (frame.timeSincePreviousFrame ?? 0) / 1000, fixedConfig);
              if (count > 0) {
                input.modify((controls) => {
                  'worklet';
                  state.modify((s) => {
                    'worklet';
                    for (let i = 0; i < count && !bus.terminal; i++) {
                      step(s, controls, fixedConfig.step, c.tick, bus);
                      c.tick++;
                      controls.down = 0;
                      controls.up = 0;
                      controls.cancelled = false;
                    }
                    return s;
                  });
                  return controls;
                });
              }
              if (bus.terminal) {
                pauseClock(c);
                running.set(false);
                input.modify((controls) => {
                  'worklet';
                  clearInput(controls);
                  return controls;
                });
              }
            } else {
              c.accumulator = 0;
              c.alpha = 1;
              c.holdLatest = true;
              c.fresh = true;
            }
            alpha.set(c.alpha);
          }
          const batch = takeBatch(bus);
          pendingEvents.set(bus.journal.count);
          if (batch) scheduleOnRN(receive, batch);
          return bus;
        });
        return c;
      });
    },
    [
      alpha,
      blocked,
      clock,
      deliveryError,
      events,
      fixedConfig,
      input,
      maxEventsPerStep,
      pendingEvents,
      probe,
      probeEnabled,
      receive,
      running,
      state,
      step,
    ],
  );
  useFrameCallback(frameCallback);
  const pause = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        resumeAfterDelivery.set(false);
        clock.modify((c) => {
          'worklet';
          pauseClock(c);
          return c;
        });
        input.modify((controls) => {
          'worklet';
          clearInput(controls);
          return controls;
        });
        running.set(false);
        alpha.set(1);
      }),
    [alpha, clock, input, resumeAfterDelivery, running],
  );
  const resume = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        if (!foreground.get() || events.get().terminal || deliveryError.get()) return;
        clock.modify((c) => {
          'worklet';
          resumeClock(c);
          return c;
        });
        running.set(true);
        alpha.set(1);
      }),
    [alpha, clock, deliveryError, events, foreground, running],
  );
  const reset = useCallback(
    () =>
      scheduleOnUI(() => {
        'worklet';
        if (deliveryError.get() || pendingEvents.get() > 0) return;
        resumeAfterDelivery.set(false);
        clock.modify((c) => {
          'worklet';
          resetClock(c);
          return c;
        });
        input.modify((controls) => {
          'worklet';
          clearInput(controls);
          return controls;
        });
        state.modify((s) => {
          'worklet';
          resetState(s);
          return s;
        });
        events.modify((bus) => {
          'worklet';
          beginSession(bus);
          return bus;
        });
        running.set(false);
        alpha.set(0);
        blocked.set(false);
      }),
    [
      alpha,
      blocked,
      clock,
      deliveryError,
      events,
      input,
      pendingEvents,
      resetState,
      resumeAfterDelivery,
      running,
      state,
    ],
  );
  const retryEvents = useCallback(() => controller.retry(), [controller]);
  useEffect(() => {
    controller.activate();
    const sub = AppState.addEventListener('change', (status) => {
      scheduleOnUI(() => {
        'worklet';
        foreground.set(status === 'active');
      });
      if (status !== 'active') pause();
    });
    return () => {
      sub.remove();
      controller.dispose();
      pause();
    };
  }, [controller, foreground, pause]);
  return {
    state,
    alpha,
    running,
    blocked,
    deliveryError,
    deliveryFailure,
    pendingEvents,
    pause,
    resume,
    reset,
    retryEvents,
    probe,
    probeEnabled,
  };
}
