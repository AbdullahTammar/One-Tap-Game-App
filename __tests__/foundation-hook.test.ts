import { createElement, StrictMode, useEffect, useMemo, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { createInput } from '../src/game/core/input';
import { emitEvent, EventKind } from '../src/game/core/events';
import { useFixedEngine, type WorkletEngine } from '../src/game/core/useFixedEngine';

let mockRegisters = 0,
  mockUnregisters = 0;
const mockFrames = new Set<(frame: FrameInfo) => void>();
let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => {
  const native = Object.create(jest.requireActual('react-native'));
  Object.defineProperty(native, 'AppState', {
    value: {
      currentState: 'active',
      addEventListener: jest.fn((_type, callback) => {
        mockAppStateListener = callback;
        return { remove: jest.fn() };
      }),
    },
  });
  return native;
});
jest.mock('react-native-worklets', () => ({
  scheduleOnUI: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
}));
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated native-free hook test
  const React = require('react') as typeof import('react');
  return {
    useSharedValue: <T>(initial: T) =>
      React.useState(() => {
        let value = initial;
        return {
          get: () => value,
          set: (next: T) => {
            value = next;
          },
          modify: (modifier: (value: T) => T) => {
            value = modifier(value);
          },
        };
      })[0],
    useFrameCallback: (callback: (frame: FrameInfo) => void) => {
      React.useEffect(() => {
        mockRegisters++;
        mockFrames.add(callback);
        return () => {
          mockUnregisters++;
          mockFrames.delete(callback);
        };
      }, [callback]);
    },
  };
});

const engine: WorkletEngine<{ x: number; previousX: number }> = {
  create: () => ({ x: 0, previousX: 0 }),
  reset: (s) => {
    s.x = 0;
    s.previousX = 0;
  },
  maxEventsPerStep: 1,
  step: (s, _input, dt, _tick, events) => {
    s.previousX = s.x;
    s.x += dt;
    if (mockEmitEvents) emitEvent(events, EventKind.score, s.x);
  },
};
let mockLoop: ReturnType<typeof useFixedEngine<{ x: number; previousX: number }>>;
let mockOwnerCommits = 0;
let mockEmitEvents = true;
let mockFailureBudget = 0;
function Owner({ fail = false }: { fail?: boolean }) {
  const initial = useMemo(() => createInput(), []),
    input = useSharedValue(initial);
  const [, score] = useState(0);
  const loop = useFixedEngine(engine, input, (event) => {
    if (mockFailureBudget > 0) {
      mockFailureBudget--;
      throw new Error('Temporary hook test failure');
    }
    if (fail) throw new Error('Injected hook test failure');
    if (event.type === 'score') score(event.value);
  });
  useEffect(() => {
    mockLoop = loop;
    mockOwnerCommits++;
  });
  return null;
}
function tick(ms = 1000 / 60) {
  for (const callback of mockFrames) callback({ timestamp: ms, timeSincePreviousFrame: ms, timeSinceFirstFrame: ms });
}
describe('foundation hook lifecycle (native APIs mocked; device verification still required)', () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers();
    mockRegisters = 0;
    mockUnregisters = 0;
    mockOwnerCommits = 0;
    mockEmitEvents = true;
    mockFailureBudget = 0;
    mockFrames.clear();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (AppState as { currentState: string }).currentState = 'active';
  });
  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
  });
  test('zero frame-driven React renders while physics advances without discrete events', () => {
    mockEmitEvents = false;
    act(() => {
      renderer = create(createElement(Owner));
    });
    const commits = mockOwnerCommits;
    act(() => mockLoop.resume());
    for (let i = 0; i < 120; i++) act(() => tick());
    expect(mockLoop.state.get().x).toBeGreaterThan(1);
    expect(mockOwnerCommits).toBe(commits);
    expect(mockRegisters).toBe(1);
  });
  test('Strict Mode effect replay reactivates delivery controller', () => {
    act(() => {
      renderer = create(createElement(StrictMode, null, createElement(Owner)));
    });
    act(() => mockLoop.resume());
    act(() => tick());
    act(() => tick());
    expect(mockLoop.deliveryError.get()).toBe(false);
    expect(mockLoop.pendingEvents.get()).toBe(0);
    expect(mockLoop.state.get().x).toBeGreaterThan(0);
  });
  test('successful automatic retry resumes without a time jump; explicit pause prevents it', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      renderer = create(createElement(Owner));
    });
    mockFailureBudget = 1;
    act(() => mockLoop.resume());
    act(() => tick());
    act(() => tick());
    const x = mockLoop.state.get().x;
    expect(mockLoop.running.get()).toBe(false);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockLoop.running.get()).toBe(true);
    expect(mockLoop.deliveryFailure).toBeNull();
    act(() => tick(10000));
    expect(mockLoop.state.get().x).toBe(x);
    mockFailureBudget = 1;
    act(() => tick());
    act(() => mockLoop.pause());
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockLoop.running.get()).toBe(false);
    log.mockRestore();
  });
  test('discrete score renders and owner updates preserve frame registration; pause/resume/reset are continuous', () => {
    act(() => {
      renderer = create(createElement(Owner));
    });
    expect(mockRegisters).toBe(1);
    act(() => mockLoop.resume());
    act(() => tick());
    act(() => tick());
    expect(mockLoop.state.get().x).toBeGreaterThan(0);
    expect(mockOwnerCommits).toBeGreaterThan(1);
    act(() => {
      renderer.update(createElement(Owner));
    });
    expect(mockRegisters).toBe(1);
    expect(mockUnregisters).toBe(0);
    const x = mockLoop.state.get().x;
    act(() => mockLoop.pause());
    expect(mockLoop.alpha.get()).toBe(1);
    act(() => tick(10000));
    expect(mockLoop.state.get().x).toBe(x);
    act(() => mockLoop.resume());
    act(() => tick(10000));
    expect(mockLoop.state.get().x).toBe(x);
    act(() => mockLoop.reset());
    expect(mockLoop.alpha.get()).toBe(0);
    expect(mockLoop.state.get().x).toBe(0);
  });
  test('background cancels recovery auto-resume and failure is visible after two retries', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      renderer = create(createElement(Owner, { fail: true }));
    });
    act(() => mockLoop.resume());
    act(() => tick());
    act(() => tick());
    expect(mockLoop.deliveryError.get()).toBe(true);
    expect(mockLoop.deliveryFailure?.status).toBe('retrying');
    act(() => {
      jest.advanceTimersByTime(750);
    });
    expect(mockLoop.deliveryFailure?.status).toBe('recoverable');
    expect(mockRegisters).toBe(1);
    act(() => {
      mockAppStateListener?.('background');
    });
    act(() => {
      renderer.update(createElement(Owner, { fail: false }));
    });
    act(() => mockLoop.retryEvents());
    expect(mockLoop.deliveryError.get()).toBe(false);
    expect(mockLoop.running.get()).toBe(false);
    act(() => {
      mockAppStateListener?.('active');
    });
    expect(mockLoop.running.get()).toBe(false);
    act(() => mockLoop.resume());
    expect(mockLoop.running.get()).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
