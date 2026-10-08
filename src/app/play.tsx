import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { IconButton, PrimaryButton, ScalePressable, SecondaryButton } from '../components/Buttons';
import { GameCanvas } from '../components/GameCanvas';
import { Icon } from '../components/Icon';
import { GAME } from '../game/constants';
import { canContinue, levelFor, type GameEvent, type GameState, type Phase } from '../game/engine';
import { getSkin } from '../game/skins';
import { useGameEngine } from '../game/useGameEngine';
import { maybeShowInterstitial, showRewarded, useAdState } from '../services/ads';
import { haptic, playSfx } from '../services/feedback';
import { maybeRequestReview } from '../services/review';
import { useProgress } from '../state/progress';
import { useAchievements } from '../state/achievements';
import { useRun } from '../state/run';
import { useAccent } from '../state/settings';
import { colors, fonts } from '../theme';

interface Hud {
  score: number;
  speed: number;
  phase: Phase;
  continued: boolean;
}

const INITIAL_HUD: Hud = { score: 0, speed: GAME.startSpeed, phase: 'ready', continued: false };

export default function Play() {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ringSize = Math.min(width - 90, height * 0.42, 420);

  const best = useProgress((s) => s.best);
  const skin = getSkin(useProgress((s) => s.equipped));
  const rewardedReady = useAdState((s) => s.rewardedReady);

  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [sheet, setSheet] = useState<'none' | 'over' | 'paused'>('none');
  const [watching, setWatching] = useState(false);
  /** The recorded run, so a continued run amends instead of double-counting. */
  const recorded = useRef<{ at: number; score: number; perfects: number; coinsEarned: number } | null>(null);
  const lastState = useRef<GameState | null>(null);

  const perfect = useSharedValue(0);
  const perfectStyle = useAnimatedStyle(() => ({
    opacity: perfect.value,
    transform: [{ translateY: (1 - perfect.value) * 8 }],
  }));

  const onEvent = useCallback(
    (event: GameEvent, s: GameState) => {
      lastState.current = s;
      switch (event.type) {
        case 'start':
        case 'resume':
          playSfx('tap');
          haptic('light');
          setSheet('none');
          setHud((h) => ({ ...h, phase: 'running' }));
          break;
        case 'hit':
          playSfx(event.perfect ? 'perfect' : 'hit');
          haptic(event.perfect ? 'medium' : 'light');
          if (event.perfect) {
            perfect.set(
              withSequence(withTiming(1, { duration: 90 }), withDelay(380, withTiming(0, { duration: 260 }))),
            );
          }
          setHud((h) => ({ ...h, score: s.score, speed: s.speed }));
          break;
        case 'miss': {
          playSfx('miss');
          haptic('error');
          const run = { score: s.score, perfects: s.perfects, topSpeed: +(s.topSpeed / s.baseSpeed).toFixed(1) };
          const progress = useProgress.getState();
          const firstMiss = !recorded.current;
          const outcome = recorded.current ? progress.amendRun(recorded.current, run) : progress.recordRun(run);
          // A continued run is the same game, so it only counts once toward plays; bests are re-checked either way.
          if (firstMiss) useAchievements.getState().reportGame({ id: 'runner', score: s.score });
          else useAchievements.getState().refresh();
          recorded.current = { at: outcome.at, score: s.score, perfects: s.perfects, coinsEarned: outcome.coinsEarned };
          useRun.getState().setLast({
            score: s.score,
            perfects: s.perfects,
            bestCombo: s.bestCombo,
            topSpeed: run.topSpeed,
            coinsEarned: outcome.coinsEarned,
            dailyBonus: outcome.dailyBonus,
            newBest: outcome.newBest,
            previousBest: outcome.previousBest,
            canContinue: canContinue(s),
            doubled: false,
          });
          setHud((h) => ({ ...h, phase: 'over', score: s.score }));
          setTimeout(() => setSheet('over'), 420);
          if (outcome.newBest) setTimeout(() => maybeRequestReview(useProgress.getState().totalGames, true), 1500);
          break;
        }
      }
    },
    [perfect],
  );

  const engine = useGameEngine(onEvent);

  const reset = useCallback(() => {
    recorded.current = null;
    lastState.current = null;
    engine.reset();
    setHud(INITIAL_HUD);
    setSheet('none');
  }, [engine]);

  const doContinue = useCallback(() => {
    engine.continueRun();
    setHud((h) => ({ ...h, phase: 'ready', continued: true }));
    setSheet('none');
    useRun.getState().patchLast({ canContinue: false });
  }, [engine]);

  const pause = useCallback(() => {
    if (hud.phase !== 'running') return;
    engine.pause();
    setHud((h) => ({ ...h, phase: 'paused' }));
    setSheet('paused');
  }, [engine, hud.phase]);

  // Requests coming back from the Results screen.
  useFocusEffect(
    useCallback(() => {
      const { request, setRequest } = useRun.getState();
      if (request === 'continue') doContinue();
      else if (request === 'retry') reset();
      if (request) setRequest(null);
    }, [doContinue, reset]),
  );

  // Pause when the app is backgrounded or a call comes in.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // Android back: pause first, leave second.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (hud.phase === 'running') {
          pause();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [hud.phase, pause]),
  );

  const retry = async () => {
    await maybeShowInterstitial();
    reset();
  };

  const openResults = async () => {
    await maybeShowInterstitial();
    router.push('/results');
  };

  const watchToContinue = async () => {
    setWatching(true);
    const earned = await showRewarded();
    setWatching(false);
    if (earned) doContinue();
  };

  const quit = () => {
    if (hud.phase === 'paused' && hud.score > 0 && lastState.current) {
      // Count an abandoned run so best/streak/daily progress are never lost.
      const s = lastState.current;
      const run = { score: s.score, perfects: s.perfects, topSpeed: +(s.topSpeed / s.baseSpeed).toFixed(1) };
      const progress = useProgress.getState();
      if (recorded.current) progress.amendRun(recorded.current, run);
      else progress.recordRun(run);
    }
    router.back();
  };

  const level = levelFor(hud.score);
  const hint =
    hud.phase === 'over'
      ? ''
      : hud.phase === 'running'
        ? 'Tap as the orb crosses the gate'
        : hud.phase === 'paused'
          ? 'Paused · tap to resume'
          : hud.continued || hud.score > 0
            ? 'Second chance · tap to resume'
            : 'Tap anywhere to start';
  const summary = useRun((s) => s.last);
  const showContinue = sheet === 'over' && !!summary?.canContinue && rewardedReady;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton
          icon="pause"
          label={hud.phase === 'running' ? 'Pause' : 'Leave game'}
          onPress={hud.phase === 'running' ? pause : quit}
        />
        <View style={styles.bestBox}>
          <AppText variant="overline" style={{ fontSize: 11 }}>
            BEST
          </AppText>
          <AppText style={styles.bestValue}>{Math.max(best, hud.score)}</AppText>
        </View>
        <View style={styles.level}>
          <AppText variant="bodyStrong" style={{ fontSize: 13 }}>
            LV {level}
          </AppText>
        </View>
      </View>

      <GestureDetector gesture={engine.gesture}>
        <View
          style={[styles.field, { paddingBottom: 56 + insets.bottom }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Tap area"
          accessibilityHint={hint}
          onAccessibilityTap={engine.tap}
        >
          <View style={{ width: ringSize, height: ringSize }}>
            <GameCanvas size={ringSize} state={engine.state} fx={engine.fx} accent={accent} skin={skin} />
            <View style={styles.scoreWrap} pointerEvents="none">
              <ScoreText score={hud.score} color={accent} scale={engine.fx.scoreScale} size={ringSize} />
              <AppText variant="overline">GATES</AppText>
            </View>
            <Animated.View style={[styles.perfect, perfectStyle]} pointerEvents="none">
              <AppText style={[styles.perfectText, { color: accent }]}>Perfect!</AppText>
            </Animated.View>
          </View>
          <View style={styles.hintBox} pointerEvents="none">
            <AppText style={styles.hint}>{hint}</AppText>
            <AppText variant="label">Speed ×{(hud.speed / GAME.startSpeed).toFixed(1)}</AppText>
          </View>
        </View>
      </GestureDetector>

      {sheet !== 'none' && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.scrim}>
          <Animated.View
            entering={SlideInDown.springify().damping(18)}
            exiting={SlideOutDown.duration(180)}
            accessibilityViewIsModal
            style={[styles.sheet, { marginBottom: 16 + insets.bottom }]}
          >
            {sheet === 'over' ? (
              <>
                <View style={{ gap: 6 }}>
                  <AppText variant="title">Missed!</AppText>
                  <AppText>
                    {summary?.newBest
                      ? `New best · ${hud.score} gates`
                      : `Score ${hud.score} · Best ${Math.max(best, hud.score)}`}
                  </AppText>
                </View>
                {showContinue && (
                  <ScalePressable
                    onPress={watchToContinue}
                    disabled={watching}
                    style={styles.continueRow}
                    accessibilityLabel="Continue run, watch a short ad"
                  >
                    <Icon name="film" size={20} color={accent} />
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>
                      Continue run
                    </AppText>
                    <AppText variant="label">Watch ad</AppText>
                  </ScalePressable>
                )}
                <View style={styles.sheetButtons}>
                  <SecondaryButton label="Results" onPress={openResults} style={{ flex: 1 }} />
                  <PrimaryButton label="Retry" size="md" onPress={retry} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <>
                <View style={{ gap: 6 }}>
                  <AppText variant="title">Paused</AppText>
                  <AppText>{hud.score} gates so far. Take a breath.</AppText>
                </View>
                <View style={styles.sheetButtons}>
                  <SecondaryButton label="Quit" onPress={quit} style={{ flex: 1 }} />
                  <PrimaryButton label="Resume" size="md" onPress={engine.tap} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

function ScoreText({
  score,
  color,
  scale,
  size,
}: {
  score: number;
  color: string;
  scale: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fontSize = Math.round(size * 0.28);
  return (
    <Animated.View style={style}>
      <AppText
        style={{ fontFamily: fonts.displayHeavy, fontSize, lineHeight: fontSize * 1.08, color }}
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={1}
      >
        {score}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: {
    height: 64,
    paddingTop: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bestBox: { alignItems: 'center', gap: 2 },
  bestValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  level: {
    height: 36,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  scoreWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
  perfect: { position: 'absolute', top: '24%', left: 0, right: 0, alignItems: 'center' },
  perfectText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.5 },
  hintBox: { alignItems: 'center', gap: 10 },
  hint: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.textSoft, minHeight: 24 },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 15, 20, 0.74)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 22,
  },
  sheetButtons: { flexDirection: 'row', gap: 12 },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
  },
});
