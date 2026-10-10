import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { useEffect, type RefObject } from 'react';
import { inputMotion, type AnyMotion, type MotionId } from './index';
export function useDeferredSensor(
  id: MotionId,
  running: boolean,
  current: RefObject<AnyMotion>,
  commit: (s: AnyMotion, publish?: boolean) => void,
) {
  useEffect(() => {
    if (id !== 'tilt' || !running || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        Accelerometer.setUpdateInterval(16);
        // iOS reports gravity with the opposite sign to Android.
        const sign = Platform.OS === 'ios' ? 1 : -1;
        sub = Accelerometer.addListener(({ x, y }) =>
          commit(inputMotion(id, current.current, { type: 'tilt', x: sign * x * 1.6, y: -sign * y * 1.6 }), false),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [id, running, current, commit]);
}
