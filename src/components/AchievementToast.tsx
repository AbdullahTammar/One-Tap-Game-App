import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic, playSfx } from '../services/feedback';
import { useAchievements } from '../state/achievements';
import { useAccent } from '../state/settings';
import { colors } from '../theme';
import { AppText } from './AppText';

/** Global banner for freshly unlocked achievements, shown one at a time. */
export function AchievementToast() {
  const toast = useAchievements((s) => s.toasts[0]);
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!toast) return;
    playSfx('unlock');
    haptic('success');
    const t = setTimeout(() => useAchievements.getState().dismissToast(), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInUp.springify().damping(16)}
        exiting={FadeOutUp}
        style={[styles.toast, { borderColor: accent }]}
        accessibilityLiveRegion="polite"
      >
        <AppText style={{ fontSize: 30 }}>{toast.icon}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="overline" color={accent}>
            ACHIEVEMENT UNLOCKED
          </AppText>
          <AppText variant="bodyStrong">{toast.title}</AppText>
        </View>
        <AppText variant="bodyStrong" color={accent}>
          +{toast.reward}
        </AppText>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { pointerEvents: 'none', position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceRaised,
  },
});
