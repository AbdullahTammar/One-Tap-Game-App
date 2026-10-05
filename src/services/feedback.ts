/**
 * Sound + haptics. Players are created once and re-used (seek + play) so a hit
 * never pays an allocation or decode cost mid-run.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { useSettings } from '../state/settings';

type Sfx = 'tap' | 'hit' | 'perfect' | 'miss' | 'unlock';

const SOURCES: Record<Sfx, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  hit: require('../../assets/sounds/hit.wav'),
  perfect: require('../../assets/sounds/perfect.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  unlock: require('../../assets/sounds/unlock.wav'),
};

const players: Partial<Record<Sfx, AudioPlayer>> = {};
let ready = false;

export async function initFeedback(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    // Respect the hardware silent switch and never interrupt the player's music.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    (Object.keys(SOURCES) as Sfx[]).forEach((key) => {
      const p = createAudioPlayer(SOURCES[key]);
      p.volume = key === 'miss' ? 0.7 : 0.55;
      players[key] = p;
    });
  } catch (e) {
    if (__DEV__) console.warn('[feedback] audio init failed', e);
  }
}

export function playSfx(key: Sfx): void {
  if (!useSettings.getState().sound) return;
  const p = players[key];
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio is best-effort — never let it break gameplay.
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'select'): void {
  if (!useSettings.getState().haptics) return;
  const run = (): Promise<void> => {
    switch (kind) {
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'select':
        return Haptics.selectionAsync();
    }
  };
  run().catch(() => {});
}
