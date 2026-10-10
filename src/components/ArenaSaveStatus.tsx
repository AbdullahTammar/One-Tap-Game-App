import { Pressable, Text, View } from 'react-native';
import { drainArenaOutbox, useArenaQueue } from '../services/arenaPersistence';
/** A handed-off match remains visible as a saving status after leaving its screen. */
export function ArenaSaveStatus() {
  const pending = useArenaQueue((s) => s.pending),
    error = useArenaQueue((s) => s.error);
  if (!pending && !error) return null;
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        padding: 12,
        backgroundColor: '#22242E',
        zIndex: 200,
      }}
      accessibilityLiveRegion="polite"
    >
      <Text style={{ color: 'white' }}>
        {error ? 'Arena rewards are waiting to save. Your events are retained.' : 'Saving Arena events…'}
      </Text>
      {error && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry saving Arena rewards"
          onPress={drainArenaOutbox}
        >
          <Text style={{ color: '#4CE0B3' }}>Retry saving</Text>
        </Pressable>
      )}
    </View>
  );
}
