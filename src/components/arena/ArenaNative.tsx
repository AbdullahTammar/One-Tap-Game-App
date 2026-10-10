/* eslint-disable @typescript-eslint/no-require-imports -- profiling module is development-only */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Keyboard, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { ArenaDashText, ArenaScene } from './ArenaScene';
import { useFixedEngine, type WorkletEngine } from '../../game/core/useFixedEngine';
import { DEFAULT_CLOCK } from '../../game/core/clock';
import { useUIInput } from '../../game/core/useInput';
import {
  ARENA_EVENT_BUDGET,
  arenaTick,
  createArenaBuffers,
  resetArena,
  orb,
  F,
  type ArenaBuffers,
} from '../../game/arena/engine';
import { MOTION_GAMES } from '../../game/motion';
import { getSkin } from '../../game/skins';
import { useProgress } from '../../state/progress';
import { useArcadeProgress } from '../../state/arcade';
import { useAchievements } from '../../state/achievements';
import { cleanName, displayName, NAME_MAX, useSettings } from '../../state/settings';
import { arenaAward, handoffArenaRun, persistArenaEvent, reserveArenaRun } from '../../services/arenaPersistence';
import { haptic, playSfx } from '../../services/feedback';
import { AppText } from '../AppText';
import { Screen } from '../UI';
import { GameHeader, GameStage, SessionOverlay } from '../GameSession';
import { DeliveryRecovery } from '../../game/core/DeliveryRecovery';
import { colors, fonts } from '../../theme';
const dev = __DEV__ ? (require('../../game/arena/dev/metrics') as typeof import('../../game/arena/dev/metrics')) : null;
const useCounter = dev?.useArenaRenderCounter ?? (() => {});
const DevPanel = dev?.ArenaProfilePanel;
const meta = MOTION_GAMES.find((g) => g.id === 'arena')!;
interface Identity {
  id: number;
  seed: number;
  best: number;
  kills: number;
}
function identity(seed?: number): Identity {
  return {
    id: reserveArenaRun(),
    seed: seed ?? (Math.random() * 0x7fffffff) | 0,
    best: useArcadeProgress.getState().best.arena ?? 0,
    kills: useAchievements.getState().counters.arenaKills,
  };
}
export default function ArenaNative({ seed, stress = false }: { seed?: number; stress?: boolean }) {
  const [run, setRun] = useState(() => identity(seed));
  return <ArenaSession key={run.id} run={run} stress={stress} onRestart={() => setRun(identity(seed))} />;
}
function ArenaSession({ run, stress, onRestart }: { run: Identity; stress: boolean; onRestart: () => void }) {
  useCounter('WorkletArenaScreen');
  const [phase, setPhase] = useState<'ready' | 'running' | 'paused' | 'over' | 'leaving'>('ready');
  const [finalScore, setFinalScore] = useState(0),
    [earned, setEarned] = useState(0),
    [endNote, setEndNote] = useState('');
  const [afterSave, setAfterSave] = useState<'leave' | 'restart' | 'legacy' | 'worklet' | null>(null);
  const destination = useRef<{ legacy: boolean; stress: boolean } | null>(null);
  const name = useSettings((s) => s.playerName),
    playerName = displayName(name);
  const skin = getSkin(useProgress((s) => s.equipped)),
    best = useArcadeProgress((s) => s.best.arena ?? 0);
  const scale = useSharedValue(1),
    enabled = useSharedValue(false),
    finished = useSharedValue(false),
    exiting = useSharedValue(0);
  const { input, gesture } = useUIInput(enabled, scale);
  const engine = useMemo<WorkletEngine<ArenaBuffers>>(
    () => ({
      create: () => {
        const s = createArenaBuffers(run.seed, run.best, run.kills);
        if (__DEV__ && stress) dev?.stressBuffers(s);
        return s;
      },
      reset: resetArena,
      step: arenaTick,
      maxEventsPerStep: ARENA_EVENT_BUDGET,
    }),
    [run.best, run.kills, run.seed, stress],
  );
  const onEvent = useCallback(
    (event: import('../../game/core/events').DiscreteEvent, session: number, sequence: number) => {
      persistArenaEvent(event, session, sequence);
      if (__DEV__) dev?.countArenaEvent(event.type);
      if (event.type === 'hit' && event.perfect) {
        playSfx('perfect');
        haptic('medium');
      }
      if (event.type === 'gameOver') {
        setFinalScore(event.score);
        setEarned(arenaAward(session)?.coins ?? 0);
        playSfx('miss');
        haptic('error');
        scheduleOnUI(() => {
          'worklet';
          finished.set(true);
        });
      }
    },
    [finished],
  );
  const loop = useFixedEngine(engine, input, onEvent, DEFAULT_CLOCK, run.id, 3600);
  const { state, running, pendingEvents, deliveryError, pause: pauseEngine, retryEvents } = loop;
  const pendingRef = useRef(afterSave);
  useEffect(() => {
    pendingRef.current = afterSave;
  }, [afterSave]);
  const settle = useCallback(
    (score: number, reason: number, rank: number) => {
      const request = pendingRef.current;
      if (request === 'restart') {
        onRestart();
        return;
      }
      if (request === 'legacy' || request === 'worklet') {
        const target = destination.current;
        if (target)
          router.replace({
            pathname: '/motion',
            params: {
              game: 'arena',
              seed: run.seed,
              engine: target.legacy ? 'legacy' : 'worklet',
              stress: target.stress ? '1' : '0',
              nonce: run.id,
            },
          });
        return;
      }
      if (request === 'leave') {
        router.replace('/');
        return;
      }
      setFinalScore(score);
      setEndNote(reason === 1 ? 'You were eaten!' : rank === 1 ? 'Champion of the arena!' : `Finished #${rank}`);
      setPhase('over');
    },
    [onRestart, run.id, run.seed],
  );
  useAnimatedReaction(
    () => {
      enabled.set(running.get());
      return (finished.get() || exiting.get() > 0) && pendingEvents.get() === 0 && !deliveryError.get()
        ? exiting.get() > 0
          ? 1000 + exiting.get()
          : 1
        : 0;
    },
    (ready, previous) => {
      if (ready > 0 && ready !== previous) {
        const s = state.get();
        scheduleOnRN(settle, s.score, s.reason, s.rank);
      }
    },
    [settle],
  );
  const pause = useCallback(() => {
    pauseEngine();
    setPhase((p) => (p === 'running' ? 'paused' : p));
    scheduleOnUI(() => {
      'worklet';
      state.modify((s) => {
        'worklet';
        s.cmdX = 0;
        s.cmdY = 0;
        s.stick = false;
        s.finger = -1;
        s.dashPending = false;
        return s;
      });
      scheduleOnRN(setFinalScore, state.get().score);
    });
  }, [pauseEngine, state]);
  useEffect(() => {
    if (!loop.deliveryFailure) return;
    scheduleOnUI(() => {
      'worklet';
      state.modify((s) => {
        'worklet';
        s.cmdX = 0;
        s.cmdY = 0;
        s.stick = false;
        s.finger = -1;
        s.dashPending = false;
        return s;
      });
    });
  }, [loop.deliveryFailure, state]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);
  const leave = useCallback(() => {
    pauseEngine();
    handoffArenaRun(run.id);
    setAfterSave('leave');
    pendingRef.current = 'leave';
    setPhase('leaving');
    scheduleOnUI(() => {
      'worklet';
      exiting.set(exiting.get() + 1);
    });
    retryEvents();
  }, [exiting, pauseEngine, retryEvents, run.id]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (running.get()) {
          pause();
          return true;
        }
        if (pendingEvents.get() > 0 || deliveryError.get()) {
          leave();
          return true;
        }
        return false;
      });
      return () => {
        sub.remove();
        pauseEngine();
      };
    }, [deliveryError, leave, pause, pauseEngine, pendingEvents, running]),
  );
  const start = () => {
    Keyboard.dismiss();
    if (phase === 'over') {
      onRestart();
      return;
    }
    setPhase('running');
    loop.resume();
  };
  const dash = useCallback(() => {
    'worklet';
    if (!running.get()) return;
    state.modify((s) => {
      'worklet';
      if (orb(s, F.dashCd, 0) <= 0 && orb(s, F.mass, 0) > 20) s.dashPending = true;
      return s;
    });
  }, [running, state]);
  const dashGesture = useMemo(() => Gesture.Tap().maxDuration(60000).onBegin(dash), [dash]);
  const compare = (legacy: boolean, stressMode: boolean) => {
    destination.current = { legacy, stress: stressMode };
    pendingRef.current = legacy ? 'legacy' : 'worklet';
    setAfterSave(legacy ? 'legacy' : 'worklet');
    loop.pause();
    handoffArenaRun(run.id);
    scheduleOnUI(() => {
      'worklet';
      exiting.set(exiting.get() + 1);
    });
    loop.retryEvents();
  };
  const share = () => {
    Share.share({ message: `I scored ${finalScore} mass in Dot Arena on Lumo! Can you beat my dot? 🔵` })
      .then((r) => {
        if (r.action === Share.sharedAction) useAchievements.getState().reportShare();
      })
      .catch(() => {});
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View
          style={styles.game}
          accessibilityElementsHidden={phase !== 'running'}
          importantForAccessibility={phase === 'running' ? 'auto' : 'no-hide-descendants'}
        >
          <GameHeader
            name={meta.name}
            color={meta.color}
            best={best}
            score={finalScore}
            scoreContent={<ArenaDashText state={state} width={90} mass />}
            unit="mass"
            running={phase === 'running'}
            onPause={pause}
            onLeave={leave}
          />
          <GameStage>
            {({ width, height }) => (
              <GestureDetector gesture={gesture}>
                <View
                  collapsable={false}
                  onLayout={() => {
                    scale.set(320 / width);
                  }}
                  accessible
                  accessibilityLabel="Dot Arena play area"
                  accessibilityHint={meta.instruction}
                  style={{ width, height, borderRadius: 22, overflow: 'hidden' }}
                >
                  <ArenaScene
                    state={state}
                    alpha={loop.alpha}
                    width={width}
                    height={height}
                    skin={skin}
                    playerName={playerName}
                  />
                </View>
              </GestureDetector>
            )}
          </GameStage>
          <View style={styles.controls}>
            <AppText variant="caption" style={{ flex: 1 }}>
              Drag to steer · eat smaller dots
            </AppText>
            <GestureDetector gesture={dashGesture}>
              <View
                collapsable={false}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Dash speed boost. Costs 12 percent mass. 2.5 second cooldown."
                onAccessibilityTap={() => scheduleOnUI(dash)}
                style={{ backgroundColor: colors.surfaceMuted, borderRadius: 16 }}
              >
                <ArenaDashText state={state} />
              </View>
            </GestureDetector>
          </View>
        </View>
        {phase !== 'running' && (
          <SessionOverlay
            title={
              phase === 'paused'
                ? 'Paused'
                : phase === 'over'
                  ? 'Round complete'
                  : phase === 'leaving'
                    ? 'Saving match'
                    : meta.name
            }
            subtitle={phase === 'ready' ? meta.description : `Peak ${finalScore} mass · Best ${best}`}
            color={meta.color}
            primary={
              phase === 'over'
                ? 'Play again'
                : phase === 'paused'
                  ? 'Resume'
                  : phase === 'leaving'
                    ? 'Retry saving'
                    : 'Start game'
            }
            onPrimary={phase === 'leaving' ? loop.retryEvents : start}
            onLeave={leave}
            onShare={phase === 'over' && finalScore > 0 ? share : undefined}
          >
            <AppText>
              {phase === 'over'
                ? `${endNote}${earned ? ` +${earned} coins.` : ''}`
                : meta.instruction + ' Dash costs 12% mass and recharges in 2.5 seconds. Grow past 20 mass to use it.'}
            </AppText>
            {phase === 'ready' && (
              <TextInput
                value={name}
                onChangeText={(text) => useSettings.getState().set('playerName', text.slice(0, NAME_MAX))}
                onEndEditing={() => useSettings.getState().set('playerName', cleanName(name))}
                placeholder="Name your dot"
                placeholderTextColor={colors.textFaint}
                maxLength={NAME_MAX}
                autoCorrect={false}
                accessibilityLabel="Your dot name"
                style={styles.name}
              />
            )}
            <DeliveryRecovery failure={loop.deliveryFailure} onRetry={loop.retryEvents} onLeave={leave} />
            {loop.deliveryFailure && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retain events and restart Arena"
                onPress={() => {
                  pauseEngine();
                  handoffArenaRun(run.id);
                  pendingRef.current = 'restart';
                  setAfterSave('restart');
                  setPhase('leaving');
                  scheduleOnUI(() => {
                    'worklet';
                    exiting.set(exiting.get() + 1);
                  });
                  retryEvents();
                }}
              >
                <AppText>Retain events and restart</AppText>
              </Pressable>
            )}
          </SessionOverlay>
        )}
        {loop.deliveryFailure && phase === 'running' && (
          <View style={styles.recovery}>
            <DeliveryRecovery failure={loop.deliveryFailure} onRetry={loop.retryEvents} onLeave={leave} />
          </View>
        )}
        {__DEV__ && DevPanel && (
          <DevPanel
            probe={loop.probe}
            enabled={loop.probeEnabled}
            variant="worklet"
            seed={run.seed}
            switchEngine={compare}
          />
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  game: { flex: 1, paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  controls: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  recovery: { position: 'absolute', top: 80, left: 20, right: 20 },
});
