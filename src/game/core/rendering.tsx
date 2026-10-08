import { Canvas, Circle, Text, usePathValue, type SkFont, type SkPathBuilder } from '@shopify/react-native-skia';
import { type ReactNode } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** Canvas tree stays static. Animation reads shared values: ZERO FRAME-DRIVEN React renders. */
export function SharedCanvas({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <Canvas pointerEvents="none" style={{ width, height }}>
      {children}
    </Canvas>
  );
}
export function SharedNumber({
  value,
  font,
  x,
  y,
  color = 'white',
  decimals = 0,
}: {
  value: SharedValue<number>;
  font: SkFont;
  x: number;
  y: number;
  color?: string;
  decimals?: number;
}) {
  const text = useDerivedValue(() => value.get().toFixed(decimals));
  return <Text x={x} y={y} text={text} font={font} color={color} />;
}
export function InterpolatedCircle({
  previousX,
  previousY,
  x,
  y,
  alpha,
  radius,
  color,
}: {
  previousX: SharedValue<number>;
  previousY: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  alpha: SharedValue<number>;
  radius: number;
  color: string;
}) {
  const cx = useDerivedValue(() => previousX.get() + (x.get() - previousX.get()) * alpha.get());
  const cy = useDerivedValue(() => previousY.get() + (y.get() - previousY.get()) * alpha.get());
  return <Circle cx={cx} cy={cy} r={radius} color={color} />;
}
/** Skia 2.6 uses a reusable PathBuilder and immutable build results. Never pass SVG d strings. */
export function useBatchedPath(draw: (builder: SkPathBuilder) => void) {
  return usePathValue(draw);
}
