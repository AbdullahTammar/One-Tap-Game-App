import { Pressable, Text, View } from 'react-native';
import type { DeliveryFailure } from './delivery';

/** Owners render this on a discrete delivery failure, never from a frame callback. */
export function DeliveryRecovery({
  failure,
  onRetry,
  onLeave,
}: {
  failure: DeliveryFailure | null;
  onRetry: () => void;
  onLeave: () => void;
}) {
  if (!failure) return null;
  return (
    <View accessibilityRole="alert" style={{ padding: 12, backgroundColor: '#fff', gap: 8 }}>
      <Text>
        {failure.status === 'retrying'
          ? 'Saving interrupted. Retrying…'
          : 'Saving could not finish. Your game is paused.'}
      </Text>
      {failure.status === 'recoverable' && (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry event delivery" onPress={onRetry}>
            <Text>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Leave paused game" onPress={onLeave}>
            <Text>Leave</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
