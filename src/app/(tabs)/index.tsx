import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { ArcadeArt } from '../../components/ArcadeArt';
import { MotionArt } from '../../components/MotionArt';
import { PrimaryButton, ScalePressable } from '../../components/Buttons';
import { Card, CoinChip, Logo, ProgressBar, RingPreview, Row, Screen } from '../../components/UI';
import { ARCADE_GAMES } from '../../game/arcade';
import { ECONOMY } from '../../game/constants';
import { MOTION_GAMES } from '../../game/motion';
import { getSkin } from '../../game/skins';
import { useArcadeProgress } from '../../state/arcade';
import { useAchievements } from '../../state/achievements';
import { PLAYER_ACHIEVEMENTS as ACHIEVEMENTS } from '../../game/achievementAvailability';
import { PLAYER_GAME_COUNT } from '../../game/availability';
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
  const trophies = useAchievements((s) => ACHIEVEMENTS.filter((a) => !!s.unlocked[a.id]).length);
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
          <AppText>{PLAYER_GAME_COUNT} ways to play. Tap, drag, swipe, draw and battle.</AppText>
        </View>
        <ScalePressable
          onPress={() => router.push('/achievements')}
          accessibilityLabel={`Achievements, ${trophies} of ${ACHIEVEMENTS.length} unlocked`}
          style={styles.trophies}
        >
          <AppText style={{ fontSize: 28 }}>🏆</AppText>
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={styles.header}>
              <AppText variant="bodyStrong">Achievements</AppText>
              <AppText variant="label">
                {trophies}/{ACHIEVEMENTS.length}
              </AppText>
            </Row>
            <ProgressBar value={trophies / ACHIEVEMENTS.length} />
          </View>
        </ScalePressable>
        <Card style={styles.featured}>
          <Row style={styles.header}>
            <AppText variant="overline" color={accent}>
              01 / THE ORIGINAL
            </AppText>
            <AppText variant="label">Best {best}</AppText>
          </Row>
          <View style={styles.art}>
            <RingPreview size={180} orbFill={skin.fill} orbStroke={skin.stroke} orbEmoji={skin.emoji} />
          </View>
          <AppText variant="heading">Dot Runner</AppText>
          <AppText>Perfect timing. Endless orbit. Tap as your dot crosses the gate.</AppText>
          <PrimaryButton label="Play Dot Runner" icon="play" onPress={() => router.push('/play')} />
        </Card>
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            More to play
          </AppText>
          <AppText variant="label">ONE TAP</AppText>
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
              <ArcadeArt
                id={game.id}
                color={game.color}
                size={96}
                orbFill={skin.fill}
                orbStroke={skin.stroke}
                orbEmoji={skin.emoji}
              />
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
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            Move & play
          </AppText>
          <AppText variant="label">{MOTION_GAMES.filter((g) => g.enabled).length} GAMES</AppText>
        </Row>
        {MOTION_GAMES.filter((g) => g.enabled).map((game, index) => (
          <ScalePressable
            key={game.id}
            accessibilityLabel={`Play ${game.name}. ${game.description} Best score ${arcadeBest[game.id]}`}
            onPress={() => router.push({ pathname: '/motion', params: { game: game.id } })}
            style={[styles.gameCard, index === 0 && styles.spotlight]}
          >
            <Row style={styles.header}>
              <AppText variant="overline" color={game.color}>
                {index === 0 ? 'NEW · ' : ''}
                {game.tag}
              </AppText>
              <AppText variant="label">Best {arcadeBest[game.id]}</AppText>
            </Row>
            <Row style={{ gap: 12, flexWrap: 'wrap' }}>
              <MotionArt
                id={game.id}
                color={game.color}
                size={index === 0 ? 150 : 96}
                orbFill={skin.fill}
                orbEmoji={skin.emoji}
                orbStroke={skin.stroke}
              />
              <View style={{ flex: 1, minWidth: 140, gap: 7 }}>
                <AppText variant="heading" style={{ fontSize: 20 }}>
                  {game.name}
                </AppText>
                <AppText>{game.description}</AppText>
                <AppText variant="label">{game.gesture}</AppText>
                <AppText variant="bodyStrong" color={game.color}>
                  Play now →
                </AppText>
              </View>
            </Row>
          </ScalePressable>
        ))}
        <AppText variant="overline">DOT RUNNER / DAILY PROGRESS</AppText>
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
  spotlight: { borderColor: '#4CE0B3', borderWidth: 1.5 },
  trophies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  grid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: 125, gap: 8 },
  cardValue: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.text },
});
