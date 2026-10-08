import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { IconButton, ScalePressable } from '../components/Buttons';
import { Icon } from '../components/Icon';
import { CoinChip, Row, Screen } from '../components/UI';
import { showRewarded, useAdState } from '../services/ads';
import { AdsEnabled, CATALOG, FreeCoins, type CoinPack } from '../services/config';
import { haptic, playSfx } from '../services/feedback';
import { purchase, usePurchaseState } from '../services/purchases';
import { useProgress } from '../state/progress';
import { useAccent, useSettings } from '../state/settings';
import { colors, fonts, radii } from '../theme';
import { dayKey, formatNumber } from '../utils/date';

export default function Shop() {
  const accent = useAccent();
  const adsRemoved = useSettings((s) => s.adsRemoved);
  const freeUsed = useSettings((s) => (s.freeCoinsDay === dayKey() ? s.freeCoinsCount : 0));
  const rewardedReady = useAdState((s) => s.rewardedReady);
  const { available, prices, busy } = usePurchaseState();
  const [watching, setWatching] = useState(false);

  const buy = async (pack: CoinPack) => {
    const result = await purchase(pack.id);
    if (result === 'success') {
      playSfx('unlock');
      haptic('success');
    } else if (result === 'error') {
      Alert.alert('Purchase failed', 'You were not charged. Please try again.');
    } else if (result === 'unavailable') {
      Alert.alert('Store unavailable', 'The store is not reachable right now. Please try again later.');
    }
  };

  const freeCoins = async () => {
    setWatching(true);
    const earned = await showRewarded();
    setWatching(false);
    if (!earned) return;
    const settings = useSettings.getState();
    const today = dayKey();
    settings.set('freeCoinsCount', (settings.freeCoinsDay === today ? settings.freeCoinsCount : 0) + 1);
    settings.set('freeCoinsDay', today);
    useProgress.getState().addCoins(FreeCoins.amount);
    playSfx('unlock');
    haptic('success');
  };

  const items = CATALOG.filter((p) => !(adsRemoved && p.removesAds && p.coins === 0));
  const freeLeft = FreeCoins.perDay - freeUsed;

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={styles.header}>
        <IconButton icon="close" label="Close shop" onPress={() => router.back()} />
        <AppText variant="bodyStrong">Shop</AppText>
        <CoinChip />
      </Row>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {AdsEnabled && (
          <ScalePressable
            onPress={freeCoins}
            disabled={!rewardedReady || freeLeft <= 0 || watching}
            accessibilityLabel={`Watch an ad for ${FreeCoins.amount} free coins`}
            style={[styles.item, styles.free, (!rewardedReady || freeLeft <= 0) && { opacity: 0.5 }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised }]}>
              <Icon name="film" color={accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">Free coins</AppText>
              <AppText variant="label">
                {freeLeft > 0 ? `Watch a short ad · ${freeLeft} left today` : 'Come back tomorrow'}
              </AppText>
            </View>
            {watching ? (
              <ActivityIndicator color={accent} />
            ) : (
              <AppText variant="bodyStrong" color={accent}>
                +{FreeCoins.amount}
              </AppText>
            )}
          </ScalePressable>
        )}

        {items.map((pack) => {
          const isBusy = busy === pack.id;
          const price = prices[pack.id] ?? pack.fallbackPrice;
          const featured = pack.id === 'lumo_starter_pack';
          return (
            <ScalePressable
              key={pack.id}
              onPress={() => buy(pack)}
              disabled={!!busy || !available}
              accessibilityLabel={`${pack.title}, ${price}`}
              style={[styles.item, featured && { borderColor: accent, borderWidth: 2 }]}
            >
              <View style={styles.iconWrap}>
                <Icon name={pack.coins > 0 ? 'coin' : 'bag'} color={accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ gap: 8 }}>
                  <AppText variant="bodyStrong">{pack.title}</AppText>
                  {pack.badge ? (
                    <View style={[styles.badge, { backgroundColor: accent }]}>
                      <AppText style={styles.badgeText}>{pack.badge}</AppText>
                    </View>
                  ) : null}
                </Row>
                <AppText variant="label">
                  {[pack.coins > 0 ? `${formatNumber(pack.coins)} coins` : null, pack.removesAds ? 'No more ads' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <View style={[styles.price, { backgroundColor: available ? accent : colors.surfaceMuted }]}>
                {isBusy ? (
                  <ActivityIndicator color={colors.ground} />
                ) : (
                  <AppText style={[styles.priceText, { color: available ? colors.ground : colors.textMuted }]}>
                    {price}
                  </AppText>
                )}
              </View>
            </ScalePressable>
          );
        })}

        {!available && (
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            The store is not available right now.
          </AppText>
        )}
        <AppText variant="caption" style={{ textAlign: 'center', lineHeight: 18 }}>
          Purchases are charged to your App Store or Google Play account. Coins are a virtual item with no cash value.
          &quot;Remove ads&quot; removes interstitial ads; optional rewarded ads stay available.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { justifyContent: 'space-between', height: 64, paddingHorizontal: 20, paddingTop: 20 },
  content: { gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  free: { borderStyle: 'dashed', borderColor: colors.outline },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ground },
  price: {
    minWidth: 76,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceText: { fontFamily: fonts.display, fontSize: 13 },
});
