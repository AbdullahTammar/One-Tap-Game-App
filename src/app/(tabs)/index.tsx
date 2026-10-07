import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { ArcadeArt } from '../../components/ArcadeArt';
import { PrimaryButton, ScalePressable } from '../../components/Buttons';
import { Card, CoinChip, Logo, ProgressBar, RingPreview, Row, Screen } from '../../components/UI';
import { ARCADE_GAMES } from '../../game/arcade';
import { ECONOMY } from '../../game/constants';
import { getSkin } from '../../game/skins';
import { useArcadeProgress } from '../../state/arcade';
import { useProgress } from '../../state/progress';
import { liveStreak } from '../../state/progressLogic';
import { useAccent } from '../../state/settings';
import { colors, fonts } from '../../theme';
import { dayKey } from '../../utils/date';

export default function Home() {
  const accent = useAccent();
  const best = useProgress((s) => s.best);
  const arcadeBest = useArcadeProgress((s) => s.best);
  const equipped = useProgress((s) => s.equipped);
  const streak = useProgress((s) => liveStreak(s, dayKey()));
  const daily = useProgress((s) => (s.dailyDay === dayKey() ? s.dailyGates : 0));
  const claimed = useProgress((s) => s.dailyDay === dayKey() && s.dailyClaimed);
  const skin = getSkin(equipped);
  const goal = ECONOMY.dailyGoalGates;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Row style={styles.header}>
          <Logo />
          <ScalePressable onPress={() => router.push('/shop')} accessibilityLabel="Open coin shop">
            <CoinChip />
          </ScalePressable>
        </Row>
        <View style={{ gap: 10 }}>
          <AppText variant="overline" color={accent}>
            THE CIRCLE COLLECTION
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            Small circles.{'\n'}Big obsession.
          </AppText>
          <AppText>Four ways to find your flow. All it takes is a tap.</AppText>
        </View>
        <Card style={styles.featured}>
          <Row style={styles.header}>
            <AppText variant="overline" color={accent}>
              01 / THE ORIGINAL
            </AppText>
            <AppText variant="label">Best {best}</AppText>
          </Row>
          <View style={styles.art}>
            <RingPreview size={180} orbFill={skin.fill} orbStroke={skin.stroke} />
          </View>
          <AppText variant="heading">Gate Runner</AppText>
          <AppText>Perfect timing. Endless orbit. Tap as your dot crosses the gate.</AppText>
          <PrimaryButton label="Play Gate Runner" icon="play" onPress={() => router.push('/play')} />
        </Card>
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            More to play
          </AppText>
          <AppText variant="label">3 NEW GAMES</AppText>
        </Row>
        {ARCADE_GAMES.map((game, index) => (
          <ScalePressable
            key={game.id}
            accessibilityLabel={`Play ${game.name}. ${game.description} Best score ${arcadeBest[game.id]}`}
            onPress={() => router.push({ pathname: '/arcade', params: { game: game.id } })}
            style={styles.gameCard}
          >
            <Row style={styles.header}>
              <AppText variant="overline" color={game.color}>
                0{index + 2} / {game.tag}
              </AppText>
              <AppText variant="label">Best {arcadeBest[game.id]}</AppText>
            </Row>
            <Row style={{ gap: 12, flexWrap: 'wrap' }}>
              <ArcadeArt id={game.id} color={game.color} size={96} />
              <View style={{ flex: 1, minWidth: 140, gap: 7 }}>
                <AppText variant="heading" style={{ fontSize: 20 }}>
                  {game.name}
                </AppText>
                <AppText>{game.description}</AppText>
                <AppText variant="bodyStrong" color={game.color}>
                  Play now →
                </AppText>
              </View>
            </Row>
          </ScalePressable>
        ))}
        <AppText variant="overline">GATE RUNNER / DAILY PROGRESS</AppText>
        <View style={styles.grid}>
          <Card style={styles.stat}>
            <AppText variant="label">Streak</AppText>
            <AppText style={styles.cardValue}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </AppText>
          </Card>
          <Card style={styles.stat}>
            <AppText variant="label">
              Daily goal · {claimed ? `+${ECONOMY.dailyGoalReward}` : `${Math.min(daily, goal)}/${goal}`}
            </AppText>
            <AppText style={styles.cardValue}>{goal} gates</AppText>
            <ProgressBar value={daily / goal} />
          </Card>
        </View>
        <AppText style={{ textAlign: 'center' }} color={colors.textFaint}>
          One dot. A whole world of play.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { gap: 22, padding: 24, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  featured: { padding: 22, gap: 14, borderWidth: 1, borderColor: colors.outline, borderRadius: 28 },
  art: { alignItems: 'center' },
  gameCard: {
    padding: 20,
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  grid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: 125, gap: 8 },
  cardValue: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
});
