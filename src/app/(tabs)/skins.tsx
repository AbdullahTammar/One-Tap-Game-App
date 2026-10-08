import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PrimaryButton, ScalePressable } from '../../components/Buttons';
import { CoinChip, OrbBadge, Row, Screen } from '../../components/UI';
import { SkinDot } from '../../components/SkinDot';
import { getSkin, MYSTERY_PRICE, mysteryPick, SKIN_CATEGORIES, SKINS, type SkinCategory } from '../../game/skins';
import { haptic, playSfx } from '../../services/feedback';
import { useProgress } from '../../state/progress';
import { useAchievements } from '../../state/achievements';
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
  const [category, setCategory] = useState<SkinCategory>(() => getSkin(equipped).category);
  const shown = SKINS.filter((sk) => sk.category === category);
  const mysteryLeft = mysteryPick(owned, 0) !== null;
  const openMystery = () => {
    const won = useProgress.getState().buyMystery();
    if (!won) return;
    useAchievements.getState().refresh();
    playSfx('unlock');
    haptic('success');
    setCategory(won.category);
    setSelected(won.id);
    Alert.alert('Mystery unlocked!', `You got ${won.emoji ?? ''} ${won.name}. It is now equipped.`);
  };
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
      useAchievements.getState().refresh();
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
              <SkinDot
                cx={150}
                cy={cur.emoji ? 40 : 30}
                r={cur.emoji ? 40 : 26}
                fill={cur.fill}
                stroke={cur.stroke}
                emoji={cur.emoji}
                strokeWidth={6}
              />
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipBar}
      >
        {SKIN_CATEGORIES.map((c) => (
          <ScalePressable
            key={c}
            feedback={false}
            onPress={() => setCategory(c)}
            accessibilityState={{ selected: c === category }}
            accessibilityLabel={`${c} skins`}
            style={[styles.chip, c === category && { backgroundColor: accent }]}
          >
            <AppText
              variant="bodyStrong"
              style={{ fontSize: 13 }}
              color={c === category ? colors.ground : colors.textSoft}
            >
              {c}
            </AppText>
          </ScalePressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {category !== 'Classic' && category !== 'Flags' && (
          <ScalePressable
            onPress={openMystery}
            disabled={!mysteryLeft || coins < MYSTERY_PRICE}
            accessibilityLabel={`Mystery skin for ${MYSTERY_PRICE} coins`}
            style={[
              styles.mystery,
              { borderColor: accent },
              (!mysteryLeft || coins < MYSTERY_PRICE) && { opacity: 0.5 },
            ]}
          >
            <AppText style={{ fontSize: 34 }}>🎁</AppText>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">Mystery skin</AppText>
              <AppText variant="label">
                {mysteryLeft ? 'A random character, monster or more' : 'You own every fun skin!'}
              </AppText>
            </View>
            <AppText variant="bodyStrong" color={accent}>
              {formatNumber(MYSTERY_PRICE)}
            </AppText>
          </ScalePressable>
        )}
        {shown.map((sk) => {
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
              <OrbBadge fill={sk.fill} stroke={sk.stroke} emoji={sk.emoji} />
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
  chipBar: { flexGrow: 0, marginTop: 14 },
  chips: { gap: 8, paddingHorizontal: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface },
  mystery: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 4 },
});
