import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Unbounded_500Medium,
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
} from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initAds } from '../services/ads';
import { initFeedback } from '../services/feedback';
import { initPurchases } from '../services/purchases';
import { useProgress } from '../state/progress';
import { colors } from '../theme';

export { ErrorBoundary } from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
SystemUI.setBackgroundColorAsync(colors.ground).catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    useProgress.getState().refreshDay();
    initFeedback();
    initPurchases();
    // Consent / ads after first paint so the UMP form never blocks the splash.
    const t = setTimeout(initAds, 600);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') useProgress.getState().refreshDay();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ground }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ground },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="arcade" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="motion" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="play" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="results" options={{ gestureEnabled: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="shop" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
