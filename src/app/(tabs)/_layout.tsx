import type { BottomTabBarProps } from 'expo-router/tabs';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { Icon, type IconName } from '../../components/Icon';
import { haptic } from '../../services/feedback';
import { useAccent } from '../../state/settings';
import { colors, fonts } from '../../theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Play', icon: 'playOutline' },
  skins: { label: 'Skins', icon: 'skins' },
  ranks: { label: 'Ranks', icon: 'ranks' },
  settings: { label: 'Settings', icon: 'settings' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12), height: 64 + Math.max(insets.bottom, 12) }]}
    >
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const color = focused ? accent : colors.textFaint;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic('select');
                navigation.navigate(route.name);
              }
            }}
            style={styles.tab}
          >
            <Icon name={meta.icon} size={24} color={color} />
            <AppText style={[styles.label, { color }]}>{meta.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="skins" />
      <Tabs.Screen name="ranks" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.ground,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
