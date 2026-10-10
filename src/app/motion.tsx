/* eslint-disable @typescript-eslint/no-require-imports -- build-time conditional requires exclude deferred modules */
import { gameEnabled } from '../game/availability';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Keyboard,
  Share,
  TextInput,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { AppText } from '../components/AppText';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { MotionArt } from '../components/MotionArt';
import { Screen } from '../components/UI';
import { GameHeader, GameStage, SessionOverlay } from '../components/GameSession';
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
const useDeferredSensor: typeof import('../game/motion/useDeferredSensor').useDeferredSensor =
  process.env.EXPO_PUBLIC_ENABLE_DEFERRED_GAMES === '1' ||
  (__DEV__ && process.env.EXPO_PUBLIC_DEV_DEFERRED_GAMES === '1') ||
  process.env.NODE_ENV === 'test'
    ? require('../game/motion/useDeferredSensor').useDeferredSensor
    : () => {};

export default function MotionRoute() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  const meta = MOTION_GAMES.find((g) => g.id === game);
  if (!gameEnabled(game)) return <Redirect href="/" />;
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
  const gameId = id;
  const [fieldWidth, setFieldWidth] = useState(320);
  const playerName = useSettings((s) => s.playerName);
  const named = id === 'arena' || id === 'paint';
  const fresh = useCallback(() => createMotion(id, randomSeed(), displayName(useSettings.getState().playerName)), [id]);
  const [state, setState] = useState<AnyMotion>(fresh);
  const [earned, setEarned] = useState(0);
  const current = useRef(state);
  const lastFrame = useRef<number | null>(null);
  const lastPaint = useRef(0);
  const best = useArcadeProgress((s) => s.best[id] ?? 0);
  const skin = getSkin(useProgress((s) => s.equipped));
  const commit = useCallback(
    (next: AnyMotion, publish = true) => {
      const previous = current.current;
      if (next === previous) return;
      current.current = next;
      if (publish || next.phase !== previous.phase) setState(next);
      if (next.score > previous.score) {
        if (next.score > (useArcadeProgress.getState().best[id] ?? 0))
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
      // Keep simulation/input responsive, but avoid reconciling hundreds of SVG nodes every frame.
      const publish = now - lastPaint.current >= 1000 / (id === 'arena' || id === 'paint' ? 30 : 60);
      if (publish) lastPaint.current = now;
      if (previous !== null) commit(stepMotion(id, current.current, (now - previous) / 1000), publish);
      if (current.current.phase === 'running') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [state.phase, commit, id]);
  // Dot Maze reads the accelerometer on devices; the web preview falls back to dragging.
  const running = state.phase === 'running';
  useDeferredSensor(gameId, running, current, commit);
  const send = useCallback((ev: MotionInput) => commit(inputMotion(id, current.current, ev), false), [commit, id]);
  const scale = 320 / fieldWidth;
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
    Keyboard.dismiss();
    lastFrame.current = null;
    const from = current.current.phase === 'over' ? fresh() : current.current;
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
  const leave = useCallback(() => router.replace('/'), []);
  const arena = id === 'arena' ? (state as ArenaState) : null;
  const cooldown = arena ? Math.ceil(arena.orbs[0].dashCd * 10) / 10 : 0;
  const dashUnavailable = !!arena && (cooldown > 0 || arena.orbs[0].mass <= ARENA.startMass);
  const instructions =
    id === 'arena'
      ? meta.instruction +
        ' Dash gives a short speed boost, costs 12% mass, and recharges in 2.5 seconds. Grow past 20 mass to use it.'
      : meta.instruction;
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View
          style={styles.game}
          accessibilityElementsHidden={!running}
          importantForAccessibility={running ? 'auto' : 'no-hide-descendants'}
        >
          <GameHeader
            name={meta.name}
            color={meta.color}
            best={best}
            score={arena ? Math.floor(arena.orbs[0].mass) : state.score}
            unit={meta.unit}
            running={running}
            onPause={pause}
            onLeave={leave}
          />
          <GameStage>
            {({ width, height, size }) => {
              const fieldSize = id === 'arena' ? width : size;
              const fieldHeight = id === 'arena' ? height : size;
              return (
                <View
                  onLayout={(e) => setFieldWidth(e.nativeEvent.layout.width)}
                  onStartShouldSetResponder={claim}
                  onMoveShouldSetResponder={claim}
                  onResponderTerminationRequest={() => false}
                  onResponderGrant={(e) => at('down', e)}
                  onResponderMove={(e) => at('move', e)}
                  onResponderRelease={(e) => at('up', e)}
                  onResponderTerminate={(e) => at('up', e)}
                  accessible
                  accessibilityLabel={meta.name + ' play area'}
                  accessibilityHint={meta.instruction}
                  style={[styles.field, { width: fieldSize, height: fieldHeight }]}
                >
                  <View style={styles.passThrough}>
                    <MotionArt
                      id={id}
                      color={meta.color}
                      size={fieldSize}
                      height={fieldHeight}
                      state={state}
                      orbFill={skin.fill}
                      orbEmoji={skin.emoji}
                      orbStroke={skin.stroke}
                    />
                  </View>
                </View>
              );
            }}
          </GameStage>
          <View style={styles.controls}>
            <AppText variant="caption" style={styles.hint} numberOfLines={2}>
              {id === 'arena' ? 'Drag to steer · eat smaller dots' : meta.gesture + ' to play'}
            </AppText>
            {meta.action && (
              <PrimaryButton
                size="md"
                label={
                  cooldown > 0
                    ? 'Recharge ' + cooldown.toFixed(1) + 's'
                    : dashUnavailable
                      ? 'Grow to dash'
                      : 'Dash · −12%'
                }
                accessibilityLabel="Dash speed boost. Costs 12 percent mass. 2.5 second cooldown."
                disabled={!running || dashUnavailable}
                onPress={() => send({ type: 'action' })}
                style={{ minWidth: 148, backgroundColor: dashUnavailable ? colors.surfaceMuted : meta.color }}
              />
            )}
          </View>
        </View>
        {!running && (
          <SessionOverlay
            title={state.phase === 'paused' ? 'Paused' : state.phase === 'over' ? 'Round complete' : meta.name}
            subtitle={
              state.phase === 'ready'
                ? meta.description
                : (arena ? 'Peak ' : '') + state.score + ' ' + meta.unit + ' · Best ' + best
            }
            color={meta.color}
            primary={
              duelPick
                ? 'Play vs bot'
                : state.phase === 'over'
                  ? 'Play again'
                  : state.phase === 'paused'
                    ? 'Resume'
                    : 'Start game'
            }
            onPrimary={() => start(duelPick ? 'bot' : undefined)}
            onLeave={leave}
            onShare={state.phase === 'over' && state.score > 0 ? share : undefined}
          >
            <AppText>
              {state.phase === 'over'
                ? (state.note || 'One more round?') + (earned ? ' +' + earned + ' coins.' : '')
                : instructions}
            </AppText>
            {named && state.phase === 'ready' && (
              <View style={{ gap: 6 }}>
                <AppText variant="caption">Your dot name</AppText>
                <TextInput
                  value={playerName}
                  onChangeText={rename}
                  onEndEditing={() => useSettings.getState().set('playerName', cleanName(playerName))}
                  placeholder="Name your dot"
                  placeholderTextColor={colors.textFaint}
                  maxLength={NAME_MAX}
                  autoCorrect={false}
                  accessibilityLabel="Your dot name"
                  style={styles.name}
                />
              </View>
            )}
            {duelPick && <SecondaryButton label="2 players · same phone" onPress={() => start('duo')} />}
          </SessionOverlay>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  game: { flex: 1, paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  field: { borderRadius: 22, overflow: 'hidden', userSelect: 'none' },
  passThrough: { pointerEvents: 'none' },
  controls: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { flex: 1, textAlign: 'center' },
  name: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});
