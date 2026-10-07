import Svg, { Circle } from 'react-native-svg';
import { type ArcadeId, type ArcadeState, createArcade } from '../game/arcade';
import { colors } from '../theme';

export function ArcadeArt({
  id,
  color,
  size,
  state = createArcade(),
  orbFill = colors.white,
  orbStroke = colors.white,
}: {
  id: ArcadeId;
  color: string;
  size: number;
  state?: ArcadeState;
  orbFill?: string;
  orbStroke?: string;
}) {
  const point = (r: number, a: number) => ({ cx: 160 + r * Math.cos(a), cy: 160 + r * Math.sin(a) });
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      {id === 'pulse' ? (
        <>
          <Circle cx={160} cy={160} r={76} stroke={color} strokeOpacity={0.12} strokeWidth={24} fill="none" />
          <Circle cx={160} cy={160} r={76} stroke={color} strokeWidth={3} strokeDasharray="3 9" fill="none" />
          <Circle cx={160} cy={160} r={Math.max(1, state.radius)} stroke={color} strokeWidth={8} fill="none" />
          <Circle cx={160} cy={160} r={7} fill={orbFill} stroke={orbStroke} strokeWidth={2} />
        </>
      ) : id === 'switch' ? (
        <>
          {[80, 120].map((r) => (
            <Circle key={r} cx={160} cy={160} r={r} stroke={colors.outline} strokeWidth={3} fill="none" />
          ))}
          <Circle
            {...point(state.obstacleLane === 0 ? 80 : 120, state.phase === 'ready' ? 0.8 : state.angle)}
            r={11}
            fill={color}
          />
          <Circle
            {...point(state.lane === 0 ? 80 : 120, -Math.PI / 2)}
            r={10}
            fill={orbFill}
            stroke={orbStroke}
            strokeWidth={2}
          />
        </>
      ) : (
        <>
          <Circle cx={160} cy={160} r={110} stroke={colors.outline} strokeWidth={4} fill="none" />
          <Circle {...point(110, state.target)} r={22} stroke={color} strokeWidth={4} fill="none" />
          <Circle {...point(110, state.angle)} r={10} fill={orbFill} stroke={orbStroke} strokeWidth={2} />
        </>
      )}
    </Svg>
  );
}
