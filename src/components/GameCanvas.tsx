import { BlurMask, Canvas, Circle, Group, Path, Skia, usePathValue } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { RING } from '../game/constants';
import { gateHalf, type GameState } from '../game/engine';
import type { GameFx } from '../game/useGameEngine';
import type { Skin } from '../game/skins';
import { colors } from '../theme';

interface Props {
  size: number;
  state: SharedValue<GameState>;
  fx: GameFx;
  accent: string;
  skin: Skin;
}

const TRAIL = 0.55;
const RAD2DEG = 180 / Math.PI;

/**
 * GPU-rendered ring. Everything animated is a derived value read on the UI
 * thread, so React never re-renders during play.
 */
export function GameCanvas({ size, state, fx, accent, skin }: Props) {
  const k = size / RING.view;
  const { center: c, radius: r, stroke } = RING;
  const oval = useMemo(() => Skia.XYWHRect(c - r, c - r, r * 2, r * 2), [c, r]);
  const transform = useMemo(() => [{ scale: k }], [k]);

  const gatePath = usePathValue((b) => {
    'worklet';
    const s = state.value;
    const h = gateHalf(s.score);
    b.arcToOval(oval, (s.gate - h) * RAD2DEG, 2 * h * RAD2DEG, true);
  });

  const trailPath = usePathValue((b) => {
    'worklet';
    const s = state.value;
    const from = s.dir > 0 ? s.angle - TRAIL : s.angle;
    b.arcToOval(oval, from * RAD2DEG, TRAIL * RAD2DEG, true);
  });

  const trailOpacity = useDerivedValue(() => (state.value.phase === 'running' ? 0.2 : 0));
  const orbX = useDerivedValue(() => c + r * Math.cos(state.value.angle));
  const orbY = useDerivedValue(() => c + r * Math.sin(state.value.angle));
  const missed = useDerivedValue(() => state.value.phase === 'over');
  const orbFill = useDerivedValue(() => (missed.value ? colors.danger : skin.fill));
  const orbStroke = useDerivedValue(() =>
    missed.value ? colors.ground : skin.stroke === skin.fill ? colors.ground : skin.stroke,
  );
  const gateColor = useDerivedValue(() => (missed.value ? colors.outline : accent));

  const pulseX = useDerivedValue(() => c + r * Math.cos(fx.pulseAngle.value));
  const pulseY = useDerivedValue(() => c + r * Math.sin(fx.pulseAngle.value));
  const pulseR = useDerivedValue(() => RING.orbRadius + 34 * fx.pulse.value);
  const pulseOpacity = useDerivedValue(() => (1 - fx.pulse.value) * 0.9);
  const shakeTransform = useDerivedValue(() => [{ translateX: fx.shake.value }]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={shakeTransform}>
        <Group transform={transform}>
          <Circle cx={c} cy={c} r={r} style="stroke" strokeWidth={stroke} color={colors.track} />
          <Path path={gatePath} style="stroke" strokeWidth={stroke} strokeCap="round" color={gateColor} />
          <Path
            path={trailPath}
            style="stroke"
            strokeWidth={stroke}
            strokeCap="round"
            color="#FFFFFF"
            opacity={trailOpacity}
          />
          <Circle
            cx={pulseX}
            cy={pulseY}
            r={pulseR}
            style="stroke"
            strokeWidth={3}
            color={accent}
            opacity={pulseOpacity}
          />
          {skin.glow ? (
            <Circle cx={orbX} cy={orbY} r={RING.orbRadius + 6} color={skin.stroke} opacity={0.55}>
              <BlurMask blur={12} style="normal" />
            </Circle>
          ) : null}
          {/* Design: r=17 orb with a 4px ground-coloured outline centred on its edge. */}
          <Circle cx={orbX} cy={orbY} r={RING.orbRadius + RING.orbOutline / 2} color={orbStroke} />
          <Circle cx={orbX} cy={orbY} r={RING.orbRadius - RING.orbOutline / 2} color={orbFill} />
        </Group>
      </Group>
    </Canvas>
  );
}
