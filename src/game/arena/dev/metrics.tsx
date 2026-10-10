import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { createProbe, sampleFrame, type Probe } from '../../core/probe';
import { PerformanceOverlay } from '../../core/dev/PerformanceOverlay';
import type { DiscreteEvent } from '../../core/events';
import { F, put, type ArenaBuffers } from '../engine';
import type { ArenaState } from '../../motion/arena';
const counters = new Map<string, () => number>(),
  events = new Map<string, number>();
export function countArenaEvent(type: DiscreteEvent['type']) {
  events.set(type, (events.get(type) ?? 0) + 1);
}
export function useArenaRenderCounter(name: string) {
  const commits = useRef(0);
  useEffect(() => {
    commits.current++;
    const read = () => commits.current;
    counters.set(name, read);
    return () => {
      if (counters.get(name) === read) counters.delete(name);
    };
  });
}
export function stressBuffers(s: ArenaBuffers) {
  put(s, F.mass, 0, 500);
  put(s, F.shield, 0, 30);
  put(s, F.magnet, 0, 30);
  for (let i = 1; i < s.count; i++) {
    const slot = s.order[i];
    const x = 700 + Math.cos(i) * 130,
      y = 700 + Math.sin(i) * 130;
    put(s, F.x, slot, x);
    put(s, F.y, slot, y);
    put(s, F.previousX, slot, x);
    put(s, F.previousY, slot, y);
    put(s, F.shield, slot, 30);
  }
  for (let i = 0; i < 260; i++) {
    s.pelletX[i] = 620 + (i % 20) * 8;
    s.pelletY[i] = 640 + Math.floor(i / 20) * 8;
  }
}
export function stressLegacy(s: ArenaState) {
  s.orbs[0].mass = 500;
  s.orbs[0].shield = 30;
  s.orbs[0].magnet = 30;
  for (let i = 1; i < s.orbs.length; i++) {
    s.orbs[i].x = 700 + Math.cos(i) * 130;
    s.orbs[i].y = 700 + Math.sin(i) * 130;
    s.orbs[i].shield = 30;
  }
  for (let i = 0; i < s.pellets.length; i++) {
    s.pellets[i].x = 620 + (i % 20) * 8;
    s.pellets[i].y = 640 + Math.floor(i / 20) * 8;
  }
}
export const ArenaProfilePanel = memo(function ArenaProfilePanel({
  probe,
  enabled,
  variant,
  seed,
  switchEngine,
}: {
  probe: SharedValue<Probe | null>;
  enabled: SharedValue<boolean>;
  variant: string;
  seed: number;
  switchEngine: (legacy: boolean, stress: boolean) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#A4A6B3', fontSize: 11 }}>
        Arena profiling · {variant} · seed {seed}
      </Text>
      <PerformanceOverlay probe={probe} enabled={enabled} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => switchEngine(true, false)}>
          <Text style={{ color: 'white', fontSize: 11 }}>Legacy</Text>
        </Pressable>
        <Pressable onPress={() => switchEngine(false, false)}>
          <Text style={{ color: 'white', fontSize: 11 }}>Worklet</Text>
        </Pressable>
        <Pressable onPress={() => switchEngine(variant === 'legacy', true)}>
          <Text style={{ color: 'white', fontSize: 11 }}>Stress</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const lines = [...counters].map(([name, read]) => `${name}: ${read()} commits`);
            lines.push(...[...events].map(([name, n]) => `${name}: ${n} events`));
            const report = lines.join('\n');
            console.info('[Arena profiling]', report);
            alert(report);
          }}
        >
          <Text style={{ color: 'white', fontSize: 11 }}>Inspect commits/events</Text>
        </Pressable>
      </View>
    </View>
  );
});
export const LegacyArenaProfile = memo(function LegacyArenaProfile({
  running,
  seed,
}: {
  running: boolean;
  seed: number;
}) {
  const initial = useMemo(() => createProbe(3600), []),
    probe = useSharedValue<Probe | null>(initial),
    enabled = useSharedValue(false);
  const callback = useCallback(
    (frame: import('react-native-reanimated').FrameInfo) => {
      'worklet';
      if (running && enabled.get())
        probe.modify((p) => {
          'worklet';
          if (p) sampleFrame(p, frame.timeSincePreviousFrame ?? 0);
          return p;
        });
    },
    [enabled, probe, running],
  );
  useFrameCallback(callback);
  return (
    <ArenaProfilePanel
      probe={probe}
      enabled={enabled}
      variant="legacy"
      seed={seed}
      switchEngine={(legacy, stress) =>
        router.replace({
          pathname: '/motion',
          params: {
            game: 'arena',
            engine: legacy ? 'legacy' : 'worklet',
            seed,
            stress: stress ? '1' : '0',
            nonce: Date.now(),
          },
        })
      }
    />
  );
});
