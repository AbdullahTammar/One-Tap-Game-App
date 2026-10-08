import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from '../components/AppText';
import { ArcadeArt } from '../components/ArcadeArt';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Row, Screen } from '../components/UI';
import { ARCADE_GAMES, createArcade, stepArcade, tapArcade, type ArcadeState } from '../game/arcade';
import { getSkin } from '../game/skins';
import { haptic, playSfx } from '../services/feedback';
import { useArcadeProgress } from '../state/arcade';
import { useProgress } from '../state/progress';
import { useAchievements } from '../state/achievements';
import { colors, fonts } from '../theme';

export default function ArcadeRoute() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  const meta = ARCADE_GAMES.find((item) => item.id === game);
  if (!meta)
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.content}>
          <AppText variant="title">Choose your circle.</AppText>
          <PrimaryButton label="Back to games" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  return <ArcadeGame key={meta.id} meta={meta} />;
}

function ArcadeGame({ meta }: { meta: (typeof ARCADE_GAMES)[number] }) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(160, Math.min(width - 48, height * 0.4, 360));
  const [state, setState] = useState(createArcade);
  const current = useRef(state);
  const lastFrame = useRef<number | null>(null);
  const best = useArcadeProgress((s) => s.best[meta.id]);
  const skin = getSkin(useProgress((s) => s.equipped));
  const commit = useCallback(
    (next: ArcadeState) => {
      const previous = current.current;
      current.current = next;
      setState(next);
      if (next.score > previous.score) {
        useArcadeProgress.getState().record(meta.id, next.score);
        playSfx(next.perfect ? 'perfect' : 'hit');
        haptic('light');
      }
      if (next.phase === 'over' && previous.phase !== 'over') {
        useAchievements.getState().reportGame({ id: meta.id, score: next.score });
        playSfx('miss');
        haptic('error');
      }
    },
    [meta.id],
  );
  const pause = useCallback(() => {
    if (current.current.phase === 'running') commit({ ...current.current, phase: 'paused' });
    lastFrame.current = null;
  }, [commit]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (current.current.phase !== 'running') return false;
        pause();
        return true;
      });
      return () => {
        sub.remove();
        pause();
      };
    }, [pause]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (value) => {
      if (value !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);
  useEffect(() => {
    if (state.phase !== 'running') return;
    let frame = 0;
    lastFrame.current = null;
    const tick = (now: number) => {
      if (current.current.phase !== 'running') return;
      const previous = lastFrame.current;
      lastFrame.current = now;
      // Long interruptions pause rather than silently killing the player's run.
      if (previous !== null && now - previous > 250) {
        pause();
        return;
      }
      if (previous !== null) commit(stepArcade(current.current, meta.id, (now - previous) / 1000));
      if (current.current.phase === 'running') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [state.phase, commit, meta.id, pause]);
  const tap = () => commit(tapArcade(current.current, meta.id));
  const leave = () => router.replace('/');
  const playing = state.phase === 'running';
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Row style={styles.header}>
          <SecondaryButton label={playing ? 'Pause' : 'Games'} onPress={playing ? pause : leave} />
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="overline">PERSONAL BEST</AppText>
            <AppText variant="heading">{best}</AppText>
          </View>
        </Row>
        <View style={styles.center}>
          <AppText variant="overline" color={meta.color}>
            {meta.tag}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {meta.name}
          </AppText>
          <AppText style={styles.instructions}>{meta.instruction}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${meta.name} tap area`}
          accessibilityHint={meta.instruction}
          disabled={!playing}
          onPress={tap}
          style={styles.field}
        >
          <ArcadeArt
            id={meta.id}
            color={meta.color}
            size={size}
            state={state}
            orbFill={skin.fill}
            orbEmoji={skin.emoji}
            orbStroke={skin.stroke}
          />
        </Pressable>
        <View style={styles.center}>
          <AppText style={[styles.score, { color: meta.color }]} accessibilityLiveRegion="polite">
            {state.score}
          </AppText>
          <AppText variant="overline">{meta.unit.toUpperCase()}</AppText>
          <AppText style={styles.status}>
            {state.phase === 'over'
              ? 'So close. One more round?'
              : state.phase === 'paused'
                ? 'Paused. Take your time.'
                : state.perfect
                  ? 'Perfect timing!'
                  : 'One tap. Find your flow.'}
          </AppText>
        </View>
        {playing ? (
          <PrimaryButton label={meta.id === 'switch' ? 'Switch lane' : 'Tap'} onPress={tap} />
        ) : (
          <PrimaryButton
            label={state.phase === 'over' ? 'Play again' : state.phase === 'paused' ? 'Resume' : 'Start game'}
            onPress={() => {
              lastFrame.current = null;
              commit(tapArcade(state.phase === 'over' ? createArcade() : current.current, meta.id));
            }}
          />
        )}
        {(state.phase === 'paused' || state.phase === 'over') && (
          <SecondaryButton label="Browse games" onPress={leave} />
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { justifyContent: 'space-between', gap: 12 },
  center: { alignItems: 'center', gap: 8 },
  instructions: { textAlign: 'center', maxWidth: 360 },
  field: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  score: { fontFamily: fonts.displayHeavy, fontSize: 46 },
  status: { color: colors.textMuted, textAlign: 'center' },
});
