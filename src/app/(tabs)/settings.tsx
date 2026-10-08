import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import type { ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ScalePressable } from '../../components/Buttons';
import { Icon } from '../../components/Icon';
import { Row, Screen } from '../../components/UI';
import { showPrivacyOptions, useAdState } from '../../services/ads';
import { Links } from '../../services/config';
import { haptic } from '../../services/feedback';
import { restorePurchases, usePurchaseState } from '../../services/purchases';
import { cleanName, NAME_MAX, useAccent, useSettings } from '../../state/settings';
import { ACCENTS, colors, fonts } from '../../theme';

export default function Settings() {
  const accent = useAccent();
  const sound = useSettings((s) => s.sound);
  const haptics = useSettings((s) => s.haptics);
  const accentId = useSettings((s) => s.accent);
  const adsRemoved = useSettings((s) => s.adsRemoved);
  const toggle = useSettings((s) => s.toggle);
  const setSetting = useSettings((s) => s.set);
  const playerName = useSettings((s) => s.playerName);
  const privacyRequired = useAdState((s) => s.privacyOptionsRequired);
  const restoring = usePurchaseState((s) => s.busy === 'restore');

  const restore = async () => {
    const result = await restorePurchases();
    Alert.alert(
      result === 'success' ? 'Purchases restored' : 'Could not restore',
      result === 'success'
        ? 'Any previous purchases are active again.'
        : result === 'unavailable'
          ? 'The store is not available right now.'
          : 'Please check your connection and try again.',
    );
  };

  const rate = async () => {
    if (await StoreReview.hasAction()) await StoreReview.requestReview();
    else {
      const url = StoreReview.storeUrl();
      if (url) Linking.openURL(url);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            Settings
          </AppText>
        </Row>

        <Section title="YOUR DOT">
          <TextInput
            value={playerName}
            onChangeText={(t) => setSetting('playerName', t.slice(0, NAME_MAX))}
            onEndEditing={() => setSetting('playerName', cleanName(playerName))}
            placeholder="Name your dot"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_MAX}
            autoCorrect={false}
            accessibilityLabel="Your dot name, shown on battle leaderboards"
            style={styles.nameInput}
          />
          <LinkRow label="Achievements" onPress={() => router.push('/achievements')} />
        </Section>

        <Section title="GAMEPLAY">
          <ToggleRow label="Sound effects" value={sound} onChange={() => toggle('sound')} accent={accent} />
          <ToggleRow label="Haptics" value={haptics} onChange={() => toggle('haptics')} accent={accent} />
        </Section>

        <Section title="ACCENT">
          <Row style={styles.swatches}>
            {ACCENTS.map((a) => {
              const active = a.id === accentId;
              return (
                <ScalePressable
                  key={a.id}
                  accessibilityLabel={`${a.name} accent`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSetting('accent', a.id)}
                  style={[styles.swatch, { borderColor: active ? a.color : 'transparent' }]}
                >
                  <View style={[styles.swatchInner, { backgroundColor: a.color }]}>
                    {active ? <Icon name="check" size={18} color={colors.ground} strokeWidth={3} /> : null}
                  </View>
                </ScalePressable>
              );
            })}
          </Row>
        </Section>

        <Section title="STORE">
          {adsRemoved ? (
            <LinkRow label="Ads removed" detail="Thank you!" />
          ) : (
            <LinkRow label="Remove ads" detail="One-time purchase" onPress={() => router.push('/shop')} />
          )}
          <LinkRow label="Coin shop" onPress={() => router.push('/shop')} />
          <LinkRow label={restoring ? 'Restoring…' : 'Restore purchases'} onPress={restoring ? undefined : restore} />
        </Section>

        <Section title="ABOUT">
          <LinkRow label="Rate Lumo" onPress={rate} />
          <LinkRow
            label="Contact support"
            onPress={() => Linking.openURL(`mailto:${Links.support}?subject=Lumo%20support`)}
          />
          {privacyRequired && <LinkRow label="Privacy options" onPress={showPrivacyOptions} />}
          <LinkRow label="Privacy policy" onPress={() => Linking.openURL(Links.privacy)} />
          <LinkRow label="Terms of use" onPress={() => Linking.openURL(Links.terms)} />
        </Section>

        <AppText variant="caption" style={{ textAlign: 'center' }}>
          Lumo {Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? '1'})
        </AppText>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <AppText variant="overline">{title}</AppText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  accent: string;
}) {
  return (
    <Row style={styles.row}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={() => {
          haptic('select');
          onChange();
        }}
        trackColor={{ false: colors.trackDim, true: accent }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.trackDim}
        accessibilityLabel={label}
      />
    </Row>
  );
}

function LinkRow({ label, detail, onPress }: { label: string; detail?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <AppText style={styles.rowLabel}>{label}</AppText>
      <Row style={{ gap: 6 }}>
        {detail ? <AppText variant="label">{detail}</AppText> : null}
        {onPress ? (
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="back" size={16} color={colors.textFaint} />
          </View>
        ) : null}
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  header: { height: 44 },
  card: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
  nameInput: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16, paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  swatches: { gap: 14, paddingVertical: 14 },
  swatch: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, padding: 4 },
  swatchInner: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
