import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { RING } from '../game/constants';
import { useProgress } from '../state/progress';
import { useAccent } from '../state/settings';
import { colors, radii } from '../theme';
import { formatNumber } from '../utils/date';
import { AppText } from './AppText';
import { Chip } from './Buttons';
import { Icon } from './Icon';

export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Logo() {
  const accent = useAccent();
  return (
    <AppText variant="logo" accessibilityRole="header">
      lumo
      <AppText variant="logo" color={accent}>
        .
      </AppText>
    </AppText>
  );
}

export function CoinChip({ value }: { value?: number }) {
  const accent = useAccent();
  const coins = useProgress((s) => s.coins);
  const shown = value ?? coins;
  return (
    <Chip>
      <Icon name="coin" size={20} color={accent} />
      <AppText variant="bodyStrong" accessibilityLabel={`${shown} coins`}>
        {formatNumber(shown)}
      </AppText>
    </Chip>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value, height = 6, color }: { value: number; height?: number; color?: string }) {
  const accent = useAccent();
  const pct = Math.max(0, Math.min(1, value));
  const fill = useAnimatedStyle(() => ({ width: withTiming(`${pct * 100}%`, { duration: 500 }) }), [pct]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.trackDim, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? accent }, fill]} />
    </View>
  );
}

/** Small orb-on-ring badge used by skin tiles and the next-unlock card. */
export function OrbBadge({ fill, stroke, size = 40 }: { fill: string; stroke: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle cx={28} cy={30} r={19} fill="none" stroke={colors.ringSlot} strokeWidth={5} />
      <Circle cx={28} cy={11} r={8} fill={fill} stroke={stroke} strokeWidth={2.5} />
    </Svg>
  );
}

function arc(from: number, to: number, r: number, c: number): string {
  const p = (a: number) => `${(c + r * Math.cos(a)).toFixed(1)} ${(c + r * Math.sin(a)).toFixed(1)}`;
  return `M ${p(from)} A ${r} ${r} 0 0 1 ${p(to)}`;
}

/** Static ring used on Home and in the skin preview. */
export function RingPreview({
  size,
  orbFill = colors.white,
  orbStroke = colors.ground,
  orbAngle = -Math.PI * 0.62,
  children,
}: {
  size: number;
  orbFill?: string;
  orbStroke?: string;
  orbAngle?: number;
  children?: ReactNode;
}) {
  const accent = useAccent();
  const { center: c, radius: r, stroke } = RING;
  const gate = -Math.PI / 2 + 1.18;
  const o = { x: c + r * Math.cos(orbAngle), y: c + r * Math.sin(orbAngle) };
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${RING.view} ${RING.view}`}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.track} strokeWidth={stroke} />
        <Path
          d={arc(gate - 0.34, gate + 0.34, r, c)}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <Path
          d={arc(orbAngle - 0.55, orbAngle, r, c)}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.18}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <Circle
          cx={o.x}
          cy={o.y}
          r={RING.orbRadius}
          fill={orbFill}
          stroke={orbStroke === orbFill ? colors.ground : orbStroke}
          strokeWidth={RING.orbOutline}
        />
      </Svg>
      {children ? <View style={StyleSheet.absoluteFill}>{children}</View> : null}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 16 },
});
