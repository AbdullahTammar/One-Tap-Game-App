import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { PrimaryButton, ScalePressable } from '../../components/Buttons';
import { Card, CoinChip, Logo, ProgressBar, RingPreview, Row, Screen } from '../../components/UI';
import { ECONOMY } from '../../game/constants';
import { getSkin } from '../../game/skins';
import { useProgress } from '../../state/progress';
import { liveStreak } from '../../state/progressLogic';
import { useAccent } from '../../state/settings';
import { colors, fonts } from '../../theme';
import { dayKey } from '../../utils/date';

export default function Home() {
  const accent = useAccent();
  const best = useProgress((s) => s.best);
  const equipped = useProgress((s) => s.equipped);
  const streak = useProgress((s) => liveStreak(s, dayKey()));
  const daily = useProgress((s) => (s.dailyDay === dayKey() ? s.dailyGates : 0));
  const claimed = useProgress((s) => s.dailyDay === dayKey() && s.dailyClaimed);
  const skin = getSkin(equipped);
  const goal = ECONOMY.dailyGoalGates;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Row style={styles.header}>
          <Logo />
          <ScalePressable onPress={() => router.push('/shop')} accessibilityLabel="Open coin shop">
            <CoinChip />
          </ScalePressable>
        </Row>

        <View style={styles.ringWrap}>
          <RingPreview size={252} orbFill={skin.fill} orbStroke={skin.stroke}>
            <View style={styles.ringCenter}>
              <AppText variant="overline">BEST</AppText>
              <AppText style={styles.best} accessibilityLabel={`Best score ${best}`}>
                {best}
              </AppText>
            </View>
          </RingPreview>
        </View>

        <View style={styles.copy}>
          <AppText variant="title" style={styles.center} accessibilityRole="header">
            One tap.{'\n'}Perfect timing.
          </AppText>
          <AppText style={styles.center}>
            Tap as the orb crosses the gate. Every hit flips its direction and speeds it up.
          </AppText>
        </View>

        <PrimaryButton label="Play" icon="play" onPress={() => router.push('/play')} />

        <View style={styles.grid}>
          <Card style={styles.stat}>
            <AppText variant="label">Streak</AppText>
            <AppText style={styles.cardValue}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </AppText>
          </Card>
          <Card style={[styles.stat, { gap: 8 }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="label">Daily goal</AppText>
              <AppText variant="label" color={claimed ? accent : colors.textSoft}>
                {claimed ? `+${ECONOMY.dailyGoalReward}` : `${Math.min(daily, goal)}/${goal}`}
              </AppText>
            </Row>
            <AppText style={[styles.cardValue, { fontSize: 15 }]}>{goal} gates</AppText>
            <ProgressBar value={daily / goal} />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 22, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  header: { justifyContent: 'space-between', height: 44 },
  ringWrap: { alignItems: 'center', paddingTop: 6 },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  best: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58, color: colors.text },
  copy: { gap: 10 },
  center: { textAlign: 'center' },
  grid: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 6 },
  cardValue: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.text },
});
