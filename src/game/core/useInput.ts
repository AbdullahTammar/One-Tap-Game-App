import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { appendPath, createInput, writeTouch } from './input';

/** Attach one Manual gesture to the field: tap-down, drag and multitouch share the same UI-owned buffers. */
export function useUIInput(enabled: SharedValue<boolean>, scale: SharedValue<number>, recordPath = false) {
  const initialInput = useMemo(() => createInput(), []);
  const input = useSharedValue(initialInput);
  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event, manager) => {
          'worklet';
          if (!enabled.get()) {
            manager.fail();
            return;
          }
          manager.activate();
          // Gesture registration stores this worklet; it does not execute it during render.
          // eslint-disable-next-line react-hooks/purity
          const now = Date.now(),
            k = scale.get();
          input.modify((s) => {
            'worklet';
            for (let i = 0; i < event.changedTouches.length; i++) {
              const t = event.changedTouches[i];
              writeTouch(s, t.id, t.x * k, t.y * k, now, 0);
              if (recordPath && i === 0) appendPath(s, t.x * k, t.y * k, now);
            }
            return s;
          });
        })
        .onTouchesMove((event) => {
          'worklet';
          if (!enabled.get()) return;
          // eslint-disable-next-line react-hooks/purity -- invoked by native touch events
          const now = Date.now(),
            k = scale.get();
          input.modify((s) => {
            'worklet';
            for (let i = 0; i < event.changedTouches.length; i++) {
              const t = event.changedTouches[i];
              writeTouch(s, t.id, t.x * k, t.y * k, now, 1);
              if (recordPath && i === 0) appendPath(s, t.x * k, t.y * k, now);
            }
            return s;
          });
        })
        .onTouchesUp((event, manager) => {
          'worklet';
          // eslint-disable-next-line react-hooks/purity -- invoked by native touch events
          const now = Date.now(),
            k = scale.get();
          input.modify((s) => {
            'worklet';
            for (let i = 0; i < event.changedTouches.length; i++) {
              const t = event.changedTouches[i];
              writeTouch(s, t.id, t.x * k, t.y * k, now, 2);
              if (recordPath && i === 0) appendPath(s, t.x * k, t.y * k, now);
            }
            return s;
          });
          let remaining = 0;
          for (let i = 0; i < input.get().active.length; i++) remaining += input.get().active[i];
          if (remaining === 0) manager.end();
        })
        .onTouchesCancelled((_event, manager) => {
          'worklet';
          input.modify((s) => {
            'worklet';
            s.cancelled = true;
            s.active.fill(0);
            return s;
          });
          manager.fail();
        }),
    [enabled, input, recordPath, scale],
  );
  return { input, gesture };
}
