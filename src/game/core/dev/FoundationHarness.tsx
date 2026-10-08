import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Circle } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { emitEvent, EventKind, type DiscreteEvent } from '../events';
import { SharedCanvas } from '../rendering';
import { useFixedEngine, type WorkletEngine } from '../useFixedEngine';
import { useUIInput } from '../useInput';
import { PerformanceOverlay, useRenderCounter } from './PerformanceOverlay';

interface Ball {
  x: number;
  previousX: number;
  taps: number;
}
const engine: WorkletEngine<Ball> = {
  create: () => ({ x: 30, previousX: 30, taps: 0 }),
  reset: (s) => {
    'worklet';
    s.x = 30;
    s.previousX = 30;
    s.taps = 0;
  },
  maxEventsPerStep: 2,
  step: (s, input, dt, _tick, events) => {
    'worklet';
    s.previousX = s.x;
    s.x += dt * 80;
    if (s.x > 290) {
      s.x = 30;
      s.previousX = 30;
    }
    if (input.down) {
      s.taps++;
      emitEvent(events, EventKind.score, s.taps);
      emitEvent(events, EventKind.hit, 1, 0);
    }
  },
};
function BallArt({
  state,
  alpha,
}: {
  state: ReturnType<typeof useFixedEngine<Ball>>['state'];
  alpha: ReturnType<typeof useFixedEngine<Ball>>['alpha'];
}) {
  const count = useRenderCounter('BallArt');
  const cx = useDerivedValue(() => {
    const s = state.get();
    return s.previousX + (s.x - s.previousX) * alpha.get();
  });
  return (
    <View>
      <SharedCanvas width={320} height={160}>
        <Circle cx={cx} cy={80} r={12} color="#4CE0B3" />
      </SharedCanvas>
      <Pressable
        onPress={() => {
          /* Explicit inspection only. */ alert(count());
        }}
      >
        <Text>Inspect art commits</Text>
      </Pressable>
    </View>
  );
}
export default function FoundationHarness() {
  const enabled = useSharedValue(false),
    scale = useSharedValue(1);
  const { input, gesture } = useUIInput(enabled, scale);
  const [score, setScore] = useState(0);
  const handler = useMemo(
    () => (event: DiscreteEvent) => {
      if (event.type === 'score') setScore(event.value);
    },
    [],
  );
  const loop = useFixedEngine(engine, input, handler);
  const running = loop.running;
  const count = useRenderCounter('FoundationHarness');
  useDerivedValue(() => {
    enabled.set(running.get());
  });
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#ddd', gap: 12 }}>
      <Text>Foundation only · score {score}</Text>
      <GestureDetector gesture={gesture}>
        <View collapsable={false} accessibilityLabel="Foundation touch field">
          <BallArt state={loop.state} alpha={loop.alpha} />
        </View>
      </GestureDetector>
      <Pressable onPress={loop.resume}>
        <Text>Resume</Text>
      </Pressable>
      <Pressable onPress={loop.pause}>
        <Text>Pause</Text>
      </Pressable>
      <Pressable onPress={loop.reset}>
        <Text>Reset</Text>
      </Pressable>
      <Pressable onPress={() => alert(count())}>
        <Text>Inspect screen commits</Text>
      </Pressable>
      <PerformanceOverlay probe={loop.probe} enabled={loop.probeEnabled} />
    </View>
  );
}
