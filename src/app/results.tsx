import * as StoreReview from 'expo-store-review';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppText } from '../components/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Card, OrbBadge, ProgressBar, Row, Screen } from '../components/UI';
import { nextUnlock } from '../game/skins';
import { showRewarded, useAdState } from '../services/ads';
import { haptic, playSfx } from '../services/feedback';
import { useProgress } from '../state/progress';
import { useRun } from '../state/run';
import { useAccent } from '../state/settings';
import { colors, fonts } from '../theme';
import { formatNumber } from '../utils/date';

export default function Results() {
  const accent = useAccent();
  const last = useRun((s) => s.last);
  const best = useProgress((s) => s.best);
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.owned);
  const rewardedReady = useAdState((s) => s.rewardedReady);
  const [watching, setWatching] = useState(false);

  if (!last) return <Redirect href="/" />;

  const unlock = nextUnlock(owned);
  const toBeat = Math.max(0, best - last.score + 1);

  const share = async () => {
    const url = StoreReview.storeUrl();
    await Share.share({
      message: `I cleared ${last.score} gates in Lumo. One tap, perfect timing — can you beat me?${url ? `\n${url}` : ''}`,
    }).catch(() => {});
  };

  const playAgain = () => {
    useRun.getState().setRequest('retry');
    router.back();
  };

  const continueRun = async () => {
    setWatching(true);
    const earned = await showRewarded();
    setWatching(false);
    if (!earned) return;
    useRun.getState().setRequest('continue');
    router.back();
  };

  const doubleCoins = async () => {
    setWatching(true);
    const earned = await showRewarded();
    setWatching(false);
    if (!earned) return;
    useProgress.getState().addCoins(last.coinsEarned);
    useRun.getState().patchLast({ doubled: true, coinsEarned: last.coinsEarned * 2 });
    playSfx('unlock');
    haptic('success');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
        <Row style={styles.header}>
          <IconButton icon="back" label="Home" onPress={() => router.dismissTo('/')} />
          <AppText variant="bodyStrong">Results</AppText>
          <IconButton icon="share" label="Share score" onPress={share} />
        </Row>

        <View style={styles.hero}>
          <AppText variant="overline">{last.newBest ? 'NEW BEST' : 'RUN OVER'}</AppText>
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <AppText variant="hero" color={accent} adjustsFontSizeToFit numberOfLines={1}>
              {last.score}
            </AppText>
          </Animated.View>
          <AppText>
            {last.newBest
              ? `Previous best ${last.previousBest} · you beat it by ${last.score - last.previousBest}`
              : `Best ${best} · ${toBeat} ${toBeat === 1 ? 'gate' : 'gates'} to beat it`}
          </AppText>
        </View>

        <Animated.View entering={FadeInDown.delay(120)} style={styles.stats}>
          <Stat value={String(last.score)} label="Gates" />
          <Stat value={`×${last.topSpeed.toFixed(1)}`} label="Top speed" />
          <Stat
            value={`+${formatNumber(last.coinsEarned + last.dailyBonus)}`}
            label={last.doubled ? 'Coins ×2' : 'Coins'}
          />
        </Animated.View>

        {last.dailyBonus > 0 && (
          <Animated.View entering={FadeInDown.delay(180)}>
            <Card style={styles.inline}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                Daily goal complete
              </AppText>
              <AppText variant="bodyStrong" color={accent}>
                +{last.dailyBonus}
              </AppText>
            </Card>
          </Animated.View>
        )}

        {unlock && (
          <Animated.View entering={FadeInDown.delay(220)}>
            <Card style={styles.inline}>
              <OrbBadge fill={unlock.fill} stroke={unlock.stroke} emoji={unlock.emoji} size={44} />
              <View style={{ flex: 1, gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
                    Next unlock: {unlock.name}
                  </AppText>
                  <AppText variant="label" color={colors.textMuted}>
                    {formatNumber(Math.min(coins, unlock.price))} / {formatNumber(unlock.price)}
                  </AppText>
                </Row>
                <ProgressBar value={coins / unlock.price} height={8} />
              </View>
            </Card>
          </Animated.View>
        )}

        <View style={styles.actions}>
          <PrimaryButton label="Play again" icon="retry" onPress={playAgain} />
          {rewardedReady && last.canContinue ? (
            <SecondaryButton label="Continue run · watch a short ad" onPress={continueRun} loading={watching} />
          ) : rewardedReady && !last.doubled && last.coinsEarned > 0 ? (
            <SecondaryButton
              label={`Double coins · watch a short ad`}
              icon="film"
              onPress={doubleCoins}
              loading={watching}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.stat}>
      <AppText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  header: { justifyContent: 'space-between', height: 44 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 28 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actions: { marginTop: 'auto', gap: 12 },
});
