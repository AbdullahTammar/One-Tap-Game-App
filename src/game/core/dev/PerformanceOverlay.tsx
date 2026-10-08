import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { summarizeProbe, type Probe } from '../probe';

/** Development harness only; import through an __DEV__ guarded require. Refresh is explicit, never frame-driven. */
export function PerformanceOverlay({
  probe,
  enabled,
}: {
  probe: SharedValue<Probe | null>;
  enabled: SharedValue<boolean>;
}) {
  const [visible, setVisible] = useState(false);
  const [report, setReport] = useState('Tap Snapshot for frame statistics');
  const update = (p50: number, p95: number, p99: number, missed60: number, missed120: number, frames: number) => {
    setReport(
      `p50 ${p50.toFixed(2)} · p95 ${p95.toFixed(2)} · p99 ${p99.toFixed(2)} ms\nLate 60Hz ${missed60}/${frames} · 120Hz ${missed120}/${frames}`,
    );
  };
  return (
    <View style={{ padding: 8, backgroundColor: '#202030' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toggle performance probe"
        onPress={() => {
          const next = !visible;
          setVisible(next);
          scheduleOnUI(() => {
            'worklet';
            enabled.set(next);
          });
        }}
      >
        <Text style={{ color: 'white' }}>Probe {visible ? 'on' : 'off'}</Text>
      </Pressable>
      {visible && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Snapshot frame statistics"
          onPress={() => {
            scheduleOnUI(() => {
              'worklet';
              const p = probe.get();
              if (!p) return;
              summarizeProbe(p);
              scheduleOnRN(update, p.p50, p.p95, p.p99, p.missed60, p.missed120, p.frames);
            });
          }}
        >
          <Text style={{ color: 'white' }}>{report}</Text>
        </Pressable>
      )}
    </View>
  );
}
/** Counts committed React renders, ignoring abandoned renders. No state updates, logging, or per-frame JS calls. */
export function useRenderCounter(name: string) {
  const commits = useRef(0);
  useEffect(() => {
    commits.current++;
  });
  return () => `${name}: ${commits.current} commits (subtract discrete-event commits)`;
}
