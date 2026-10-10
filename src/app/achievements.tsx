import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { IconButton } from '../components/Buttons';
import { ProgressBar, Row, Screen } from '../components/UI';
import { PLAYER_ACHIEVEMENTS as ACHIEVEMENTS, playerStats } from '../game/achievementAvailability';
import { currentStats, useAchievements } from '../state/achievements';
import { useArcadeProgress } from '../state/arcade';
import { useProgress } from '../state/progress';
import { displayName, useAccent, useSettings } from '../state/settings';
import { colors, radii } from '../theme';
import { formatNumber } from '../utils/date';

export default function Achievements() {
  const accent = useAccent();
  const counters = useAchievements((s) => s.counters);
  const unlocked = useAchievements((s) => s.unlocked);
  // Subscribing keeps progress bars live as bests and skins change.
  useArcadeProgress((s) => s.best);
  useProgress((s) => s.best + s.owned.length);
  const name = displayName(useSettings((s) => s.playerName));
  const stats = playerStats(currentStats(counters));
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const earned = ACHIEVEMENTS.filter((a) => unlocked[a.id]).reduce((n, a) => n + a.reward, 0);
  const sorted = [...ACHIEVEMENTS].sort(
    (a, b) =>
      Number(!!unlocked[a.id]) - Number(!!unlocked[b.id]) || b.progress(stats) / b.goal - a.progress(stats) / a.goal,
  );
  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={styles.header}>
        <IconButton icon="close" label="Close achievements" onPress={() => router.back()} />
        <AppText variant="bodyStrong">Achievements</AppText>
        <View style={{ width: 44 }} />
      </Row>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { borderColor: accent }]}>
          <AppText variant="overline" color={accent}>
            {name.toUpperCase()}
          </AppText>
          <AppText variant="title">
            {done}/{ACHIEVEMENTS.length}
          </AppText>
          <ProgressBar value={done / ACHIEVEMENTS.length} />
          <AppText variant="label">
            {formatNumber(stats.plays)} {stats.plays === 1 ? 'game' : 'games'} played · {formatNumber(earned)} coins
            earned from achievements
          </AppText>
        </View>
        {sorted.map((a) => {
          const have = !!unlocked[a.id];
          const value = Math.min(a.progress(stats), a.goal);
          return (
            <View
              key={a.id}
              style={[styles.item, have && { borderColor: accent }]}
              accessible
              accessibilityLabel={`${a.title}. ${a.description} ${have ? 'Unlocked' : `${value} of ${a.goal}`}. Reward ${a.reward} coins.`}
            >
              <AppText style={[styles.icon, !have && { opacity: 0.45 }]}>{a.icon}</AppText>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="bodyStrong">{a.title}</AppText>
                <AppText variant="label">{a.description}</AppText>
                {!have && a.goal > 1 && (
                  <View style={{ gap: 4 }}>
                    <ProgressBar value={value / a.goal} />
                    <AppText variant="caption">
                      {formatNumber(value)} / {formatNumber(a.goal)}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText variant="bodyStrong" color={have ? accent : colors.textFaint}>
                {have ? '✓' : `+${a.reward}`}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  content: { padding: 20, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  summary: { gap: 10, padding: 20, borderRadius: radii.lg, borderWidth: 1.5, backgroundColor: colors.surface },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  icon: { fontSize: 30 },
});
