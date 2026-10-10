import { memo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { AppText } from './AppText';
import { PrimaryButton, SecondaryButton } from './Buttons';

export const GameHeader = memo(function GameHeader({
  name,
  color,
  best,
  score,
  unit,
  running,
  onPause,
  onLeave,
  scoreContent,
}: {
  name: string;
  color: string;
  best: number;
  score: number;
  unit: string;
  running: boolean;
  onPause: () => void;
  onLeave: () => void;
  scoreContent?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause game' : 'Back to games'}
        onPress={running ? onPause : onLeave}
        style={styles.nav}
      >
        <AppText variant="bodyStrong">{running ? 'Pause' : 'Games'}</AppText>
      </Pressable>
      <View style={styles.title}>
        <AppText variant="bodyStrong" numberOfLines={1} style={{ fontSize: 17 }}>
          {name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          Best {best}
        </AppText>
      </View>
      <View style={styles.stat}>
        {scoreContent ?? (
          <AppText color={color} style={styles.score} numberOfLines={1}>
            {score}
          </AppText>
        )}
        <AppText variant="caption" numberOfLines={1}>
          {unit}
        </AppText>
      </View>
    </View>
  );
});

/** Measure the space left after safe areas and controls, rather than guessing from screen height. */
export function GameStage({
  children,
}: {
  children: (space: { width: number; height: number; size: number }) => ReactNode;
}) {
  const [space, setSpace] = useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.stage}
      onLayout={({ nativeEvent: { layout } }) => {
        const width = Math.floor(layout.width);
        const height = Math.floor(layout.height);
        setSpace((old) => (old.width === width && old.height === height ? old : { width, height }));
      }}
    >
      {space.width > 0 && space.height > 0 && children({ ...space, size: Math.min(space.width, space.height) })}
    </View>
  );
}

export function SessionOverlay({
  title,
  subtitle,
  color,
  children,
  primary,
  onPrimary,
  onLeave,
  onShare,
}: {
  title: string;
  subtitle: string;
  color: string;
  children?: ReactNode;
  primary: string;
  onPrimary: () => void;
  onLeave: () => void;
  onShare?: () => void;
}) {
  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overlayScroll}>
        <View style={styles.card}>
          <AppText variant="title" accessibilityRole="header" style={{ fontSize: 25 }}>
            {title}
          </AppText>
          <AppText color={color} variant="bodyStrong">
            {subtitle}
          </AppText>
          {children}
          <PrimaryButton label={primary} size="md" onPress={onPrimary} style={{ backgroundColor: color }} />
          {onShare && <SecondaryButton label="Share score" onPress={onShare} />}
          <Pressable accessibilityRole="button" onPress={onLeave} style={styles.browse}>
            <AppText variant="bodyStrong">Back to games</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60 },
  nav: {
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, gap: 2 },
  stat: { alignItems: 'flex-end', maxWidth: '30%' },
  score: { fontFamily: fonts.displayHeavy, fontSize: 23 },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(14,15,20,0.84)' },
  overlayScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  browse: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
