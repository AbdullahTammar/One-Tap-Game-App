import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { ArcadeArt } from '../components/ArcadeArt';
import { PrimaryButton } from '../components/Buttons';
import { Screen } from '../components/UI';
import { GameHeader, GameStage, SessionOverlay } from '../components/GameSession';
import { ARCADE_GAMES, createArcade, stepArcade, tapArcade, type ArcadeState } from '../game/arcade';
import { getSkin } from '../game/skins';
import { haptic, playSfx } from '../services/feedback';
import { useArcadeProgress } from '../state/arcade';
import { useProgress } from '../state/progress';
import { useAchievements } from '../state/achievements';
import { colors } from '../theme';

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
  const [state, setState] = useState(createArcade);
  const current = useRef(state);
  const lastFrame = useRef<number | null>(null);
  const lastPaint = useRef(0);
  const best = useArcadeProgress((s) => s.best[meta.id]);
  const skin = getSkin(useProgress((s) => s.equipped));
  const commit = useCallback(
    (next: ArcadeState, publish = true) => {
      const previous = current.current;
      current.current = next;
      if (publish || next.phase !== previous.phase) setState(next);
      if (next.score > previous.score) {
        if (next.score > useArcadeProgress.getState().best[meta.id])
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
      const publish = now - lastPaint.current >= 1000 / 60;
      if (publish) lastPaint.current = now;
      if (previous !== null)
        commit(stepArcade(current.current, meta.id, Math.min((now - previous) / 1000, 0.05)), publish);
      if (current.current.phase === 'running') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [state.phase, commit, meta.id]);
  const tap = () => commit(tapArcade(current.current, meta.id));
  const leave = useCallback(() => router.replace('/'), []);
  const playing = state.phase === 'running';
  const start = () => {
    lastFrame.current = null;
    commit(tapArcade(current.current.phase === 'over' ? createArcade() : current.current, meta.id));
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View
          style={styles.game}
          accessibilityElementsHidden={!playing}
          importantForAccessibility={playing ? 'auto' : 'no-hide-descendants'}
        >
          <GameHeader
            name={meta.name}
            color={meta.color}
            best={best}
            score={state.score}
            unit={meta.unit}
            running={playing}
            onPause={pause}
            onLeave={leave}
          />
          <GameStage>
            {({ width, height, size }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={meta.name + ' tap area'}
                accessibilityHint={meta.instruction}
                disabled={!playing}
                onPressIn={tap}
                style={[styles.field, { width, height }]}
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
            )}
          </GameStage>
          <AppText variant="caption" style={styles.hint}>
            {state.perfect
              ? 'Perfect timing!'
              : meta.id === 'switch'
                ? 'Tap anywhere to switch lanes'
                : 'Tap anywhere in the field'}
          </AppText>
        </View>
        {!playing && (
          <SessionOverlay
            title={state.phase === 'paused' ? 'Paused' : state.phase === 'over' ? 'Round complete' : meta.name}
            subtitle={state.phase === 'ready' ? meta.description : state.score + ' ' + meta.unit + ' · Best ' + best}
            color={meta.color}
            primary={state.phase === 'over' ? 'Play again' : state.phase === 'paused' ? 'Resume' : 'Start game'}
            onPrimary={start}
            onLeave={leave}
          >
            <AppText>{state.phase === 'over' ? 'One more round?' : meta.instruction}</AppText>
          </SessionOverlay>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  game: { flex: 1, paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  field: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 22 },
  hint: { minHeight: 32, textAlign: 'center', paddingVertical: 6 },
});
