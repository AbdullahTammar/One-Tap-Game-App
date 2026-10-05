import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '../services/feedback';
import { useAccent } from '../state/settings';
import { colors, fonts } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

interface ScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Haptic tick on press. */
  feedback?: boolean;
}

export function ScalePressable({
  style,
  children,
  feedback = true,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: ScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(0.96, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback) haptic('light');
        onPress?.(e);
      }}
      style={[style, animated]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'lg' | 'md';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  size = 'lg',
  style,
  accessibilityLabel,
}: ButtonProps) {
  const accent = useAccent();
  const h = size === 'lg' ? 64 : 56;
  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        { height: h, borderRadius: h / 2, backgroundColor: disabled ? colors.surfaceMuted : accent },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ground} />
      ) : (
        <>
          {icon ? (
            <Icon name={icon} size={22} color={disabled ? colors.textMuted : colors.ground} strokeWidth={2.5} />
          ) : null}
          <AppText
            variant="button"
            color={disabled ? colors.textMuted : colors.ground}
            style={{ fontSize: size === 'lg' ? 18 : 16 }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </>
      )}
    </ScalePressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled, loading, style, accessibilityLabel }: ButtonProps) {
  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.base, styles.secondary, disabled && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={colors.text} /> : null}
          <AppText style={styles.secondaryLabel} numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </ScalePressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress?: () => void; label: string }) {
  return (
    <ScalePressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={styles.iconButton}>
      <Icon name={icon} size={20} color={colors.text} strokeWidth={2.5} />
    </ScalePressable>
  );
}

export function Chip({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.chip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  secondary: { height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.outline },
  secondaryLabel: { fontFamily: fonts.bodyBold, fontSize: 15 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
  },
});
