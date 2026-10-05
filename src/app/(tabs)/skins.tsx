import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PrimaryButton, ScalePressable } from '../../components/Buttons';
import { CoinChip, OrbBadge, Row, Screen } from '../../components/UI';
import { getSkin, SKINS } from '../../game/skins';
import { haptic, playSfx } from '../../services/feedback';
import { useProgress } from '../../state/progress';
import { useAccent } from '../../state/settings';
import { colors, radii } from '../../theme';
import { formatNumber } from '../../utils/date';

export default function Skins() {
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((Math.min(width, 600) - 48 - 20) / 3);
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.owned);
  const equipped = useProgress((s) => s.equipped);
  const [selected, setSelected] = useState(equipped);
  const cur = getSkin(selected);
  const curOwned = owned.includes(cur.id);

  const detail =
    cur.id === equipped
      ? 'Equipped'
      : curOwned
        ? 'Owned · ready to equip'
        : `Locked · ${formatNumber(cur.price)} coins`;

  let label: string;
  let disabled = false;
  let action: 'equip' | 'unlock' | 'shop' | null = null;
  if (cur.id === equipped) {
    label = 'Equipped';
    disabled = true;
  } else if (curOwned) {
    label = `Equip ${cur.name}`;
    action = 'equip';
  } else if (coins >= cur.price) {
    label = `Unlock for ${formatNumber(cur.price)}`;
    action = 'unlock';
  } else {
    label = `Get ${formatNumber(cur.price - coins)} more coins`;
    action = 'shop';
  }

  const onAction = () => {
    if (action === 'shop') {
      router.push('/shop');
      return;
    }
    const result = useProgress.getState().selectSkin(cur.id);
    if (result === 'unlocked') {
      playSfx('unlock');
      haptic('success');
    } else if (result === 'equipped') {
      haptic('select');
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            Skins
          </AppText>
          <ScalePressable onPress={() => router.push('/shop')} accessibilityLabel="Open coin shop">
            <CoinChip />
          </ScalePressable>
        </Row>

        <View style={styles.preview}>
          <Animated.View key={cur.id} entering={ZoomIn.springify().damping(15)}>
            <Svg width={136} height={136} viewBox="0 0 300 300">
              <Circle cx={150} cy={150} r={120} fill="none" stroke={colors.trackDim} strokeWidth={22} />
              <Path
                d="M 233.6 63.9 A 120 120 0 0 1 267.6 126.2"
                fill="none"
                stroke={accent}
                strokeWidth={22}
                strokeLinecap="round"
              />
              <Circle cx={150} cy={30} r={26} fill={cur.fill} stroke={cur.stroke} strokeWidth={6} />
            </Svg>
          </Animated.View>
          <View style={{ gap: 6, flex: 1 }}>
            <AppText variant="heading">{cur.name}</AppText>
            <AppText variant="bodyStrong" color={colors.textMuted} style={{ fontSize: 14 }}>
              {detail}
            </AppText>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {SKINS.map((sk) => {
          const isOwned = owned.includes(sk.id);
          const isEquipped = sk.id === equipped;
          const isSelected = sk.id === selected;
          const status = isEquipped ? 'Equipped' : isOwned ? 'Owned' : formatNumber(sk.price);
          return (
            <ScalePressable
              key={sk.id}
              onPress={() => setSelected(sk.id)}
              feedback={false}
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${sk.name}, ${isEquipped ? 'equipped' : isOwned ? 'owned' : `${sk.price} coins`}`}
              style={[styles.tile, { width: tileWidth, borderColor: isSelected ? accent : colors.surface }]}
            >
              <OrbBadge fill={sk.fill} stroke={sk.stroke} />
              <AppText variant="bodyStrong" style={{ fontSize: 13 }}>
                {sk.name}
              </AppText>
              <AppText variant="caption" color={isEquipped ? accent : isOwned ? colors.textSoft : colors.textFaint}>
                {status}
              </AppText>
            </ScalePressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={label} size="md" disabled={disabled} onPress={onAction} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 24, paddingTop: 20, gap: 16 },
  header: { justifyContent: 'space-between', height: 44 },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 20,
    height: 176,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  tile: {
    height: 100,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 4 },
});
