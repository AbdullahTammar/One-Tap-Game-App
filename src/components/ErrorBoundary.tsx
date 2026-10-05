import type { ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';

import { colors } from '../theme';
import { AppText } from './AppText';
import { PrimaryButton } from './Buttons';

/** Last-resort screen: never show players a red box or a blank app. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground, justifyContent: 'center', padding: 24, gap: 16 }}>
      <AppText variant="title">Something went wrong</AppText>
      <AppText>Your progress is safe. Tap below to jump back in.</AppText>
      <PrimaryButton label="Try again" onPress={retry} />
    </View>
  );
}
