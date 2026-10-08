import { G, Circle, Text as SvgText } from 'react-native-svg';

/** A player's dot inside any SVG: the skin colors, plus its character or flag when it has one. */
export function SkinDot({
  cx,
  cy,
  r,
  fill,
  stroke,
  emoji,
  strokeWidth = 2,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  emoji?: string;
  strokeWidth?: number;
}) {
  if (!emoji) return <Circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  const size = r * 1.7;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Emoji glyphs sit slightly above the baseline; 0.36 centres them on iOS, Android and web. */}
      <SvgText x={cx} y={cy + size * 0.36} fontSize={size} textAnchor="middle">
        {emoji}
      </SvgText>
    </G>
  );
}
