import { Accelerometer } from 'expo-sensors';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  Share,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { AppText } from '../components/AppText';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { MotionArt } from '../components/MotionArt';
import { Row, Screen } from '../components/UI';
import {
  createMotion,
  inputMotion,
  isMotionId,
  MOTION_GAMES,
  stepMotion,
  type AnyMotion,
  type MotionInput,
  type MotionMeta,
} from '../game/motion';
import { randomSeed } from '../game/motion/common';
import { getSkin } from '../game/skins';
import { haptic, playSfx } from '../services/feedback';
import { useArcadeProgress } from '../state/arcade';
import { useProgress } from '../state/progress';
import { useAchievements } from '../state/achievements';
import type { ArenaState } from '../game/motion/arena';
import type { PaintState } from '../game/motion/paint';
import { ARENA } from '../game/motion/arena';
import { cleanName, displayName, NAME_MAX, useSettings } from '../state/settings';
import type { DuelState } from '../game/motion/duel';
import { colors, fonts } from '../theme';

export default function MotionRoute() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  const meta = MOTION_GAMES.find((g) => g.id === game);
  if (!meta || !isMotionId(game))
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.content}>
          <AppText variant="title">Pick a game.</AppText>
          <PrimaryButton label="Back to games" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  return <MotionGame key={meta.id} meta={meta} />;
}

function MotionGame({ meta }: { meta: MotionMeta }) {
  const id = meta.id;
  const { width, height } = useWindowDimensions();
  const size = Math.max(200, Math.min(width - 32, height * 0.52, 440));
  const playerName = useSettings((s) => s.playerName);
  const named = id === 'arena' || id === 'paint';
  const fresh = useCallback(() => createMotion(id, randomSeed(), displayName(useSettings.getState().playerName)), [id]);
  const [state, setState] = useState<AnyMotion>(fresh);
  const [earned, setEarned] = useState(0);
  const current = useRef(state);
  const lastFrame = useRef<number | null>(null);
  const best = useArcadeProgress((s) => s.best[id] ?? 0);
  const skin = getSkin(useProgress((s) => s.equipped));
  const commit = useCallback(
    (next: AnyMotion) => {
      const previous = current.current;
      if (next === previous) return;
      current.current = next;
      setState(next);
      if (next.score > previous.score) {
        useArcadeProgress.getState().record(id, next.score);
        // Arena mass ticks up constantly; only kills deserve a sound there.
        if (id !== 'arena' || next.perfect) {
          playSfx(next.perfect ? 'perfect' : 'hit');
          haptic(next.perfect ? 'medium' : 'light');
        }
      }
      if (next.phase === 'over' && previous.phase !== 'over') {
        useArcadeProgress.getState().record(id, next.score);
        const arena = id === 'arena' ? (next as ArenaState) : null;
        const duel = id === 'duel' ? (next as DuelState) : null;
        const { coins } = useAchievements.getState().reportGame({
          id,
          score: next.score,
          arenaKills: arena?.kills,
          arenaWin: !!arena && arena.rank === 1 && arena.elapsed >= ARENA.matchTime,
          paintKills: id === 'paint' ? (next as PaintState).painters[0].kills : 0,
          duelWin: !!duel && duel.mode === 'bot' && duel.winner === 0,
          duo: !!duel && duel.mode === 'duo',
          linked: id === 'flow' ? next.score : 0,
        });
        setEarned(coins);
        playSfx('miss');
        haptic('error');
      }
    },
    [id],
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
    const sub = AppState.addEventListener('change', (v) => {
      if (v !== 'active') pause();
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
      if (previous !== null && now - previous > 250) {
        pause();
        return;
      }
      if (previous !== null) commit(stepMotion(id, current.current, (now - previous) / 1000));
      if (current.current.phase === 'running') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [state.phase, commit, id, pause]);
  // Dot Maze reads the accelerometer on devices; the web preview falls back to dragging.
  const running = state.phase === 'running';
  useEffect(() => {
    if (id !== 'tilt' || !running || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        Accelerometer.setUpdateInterval(16);
        // iOS reports gravity with the opposite sign to Android.
        const sign = Platform.OS === 'ios' ? 1 : -1;
        sub = Accelerometer.addListener(({ x, y }) =>
          commit(inputMotion(id, current.current, { type: 'tilt', x: sign * x * 1.6, y: -sign * y * 1.6 })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [id, running, commit]);
  const send = useCallback((ev: MotionInput) => commit(inputMotion(id, current.current, ev)), [commit, id]);
  const scale = 320 / size;
  const at = (type: 'down' | 'move' | 'up', e: GestureResponderEvent) => {
    const { locationX, locationY, touches } = e.nativeEvent;
    if (id === 'duel') {
      // Multi-touch: every finger still down. Some web pointers report no touches, so fall back to the pointer.
      const points = touches?.length
        ? touches.map((t) => ({ x: t.locationX * scale, y: t.locationY * scale }))
        : type === 'up'
          ? []
          : [{ x: locationX * scale, y: locationY * scale }];
      send({ type: 'touches', points });
      return;
    }
    send({ type, x: locationX * scale, y: locationY * scale });
  };
  const claim = () => current.current.phase === 'running';
  const start = (mode?: DuelState['mode']) => {
    lastFrame.current = null;
    const from = state.phase === 'over' ? fresh() : current.current;
    commit({ ...from, ...(mode ? { mode } : null), phase: 'running' } as AnyMotion);
  };
  const share = () => {
    Share.share({
      message: `I scored ${state.score} ${meta.unit} in ${meta.name} on Lumo! Can you beat my dot? 🔵`,
    })
      .then((r) => {
        if (r.action === Share.sharedAction) useAchievements.getState().reportShare();
      })
      .catch(() => {});
  };
  const rename = (text: string) => {
    useSettings.getState().set('playerName', text.slice(0, NAME_MAX));
    // Ready screens rebuild the match so the new name shows on the leaderboard straight away.
    if (current.current.phase === 'ready') commit(createMotion(id, current.current.seed, displayName(text)));
  };
  const duelPick = id === 'duel' && state.phase !== 'running' && state.phase !== 'paused';
  const leave = () => router.replace('/');
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Row style={styles.header}>
          <SecondaryButton label={running ? 'Pause' : 'Games'} onPress={running ? pause : leave} />
          <View style={styles.center}>
            <AppText variant="overline" color={meta.color}>
              {meta.tag}
            </AppText>
            <AppText variant="heading" accessibilityRole="header">
              {meta.name}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="overline">BEST</AppText>
            <AppText variant="heading">{best}</AppText>
          </View>
        </Row>
        <AppText style={styles.instructions}>{meta.instruction}</AppText>
        <View
          onStartShouldSetResponder={claim}
          onMoveShouldSetResponder={claim}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => at('down', e)}
          onResponderMove={(e) => at('move', e)}
          onResponderRelease={(e) => at('up', e)}
          onResponderTerminate={(e) => at('up', e)}
          accessible
          accessibilityLabel={`${meta.name} play area`}
          accessibilityHint={meta.instruction}
          style={[styles.field, { width: size, height: size }]}
        >
          <View style={styles.passThrough}>
            <MotionArt
              id={id}
              color={meta.color}
              size={size}
              state={state}
              orbFill={skin.fill}
              orbEmoji={skin.emoji}
              orbStroke={skin.stroke}
            />
          </View>
        </View>
        <Row style={styles.scoreRow}>
          <View>
            <AppText style={[styles.score, { color: meta.color }]} accessibilityLiveRegion="polite">
              {state.score}
            </AppText>
            <AppText variant="overline">{meta.unit.toUpperCase()}</AppText>
          </View>
          <AppText style={styles.status}>
            {state.phase === 'over'
              ? `${state.note ? `${state.note}. ` : ''}${earned ? `+${earned} coins. ` : ''}One more?`
              : state.phase === 'paused'
                ? 'Paused. Take your time.'
                : state.phase === 'ready'
                  ? meta.description
                  : state.note}
          </AppText>
        </Row>
        {named && state.phase === 'ready' && (
          <TextInput
            value={playerName}
            onChangeText={rename}
            onEndEditing={() => useSettings.getState().set('playerName', cleanName(playerName))}
            placeholder="Name your dot"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_MAX}
            autoCorrect={false}
            accessibilityLabel="Your dot name for the leaderboard"
            style={styles.name}
          />
        )}
        {duelPick ? (
          <Row style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="vs Bot" onPress={() => start('bot')} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="2 Players" onPress={() => start('duo')} />
            </View>
          </Row>
        ) : running ? (
          meta.action ? (
            <PrimaryButton label={meta.action} onPress={() => send({ type: 'action' })} />
          ) : null
        ) : (
          <PrimaryButton
            label={state.phase === 'over' ? 'Play again' : state.phase === 'paused' ? 'Resume' : 'Start game'}
            onPress={() => start()}
          />
        )}
        {state.phase === 'over' && state.score > 0 && <SecondaryButton label="Share score" onPress={share} />}
        {(state.phase === 'paused' || state.phase === 'over') && (
          <SecondaryButton label="Browse games" onPress={leave} />
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, padding: 16, gap: 14, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { justifyContent: 'space-between', gap: 12 },
  center: { alignItems: 'center', gap: 2, flex: 1 },
  instructions: { textAlign: 'center', color: colors.textMuted },
  field: { alignSelf: 'center', borderRadius: 28, overflow: 'hidden', userSelect: 'none' },
  passThrough: { pointerEvents: 'none' },
  name: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    textAlign: 'center',
  },
  scoreRow: { justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  score: { fontFamily: fonts.displayHeavy, fontSize: 40 },
  status: { color: colors.textSoft, textAlign: 'right', flex: 1 },
});
