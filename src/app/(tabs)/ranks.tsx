import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { Card, ProgressBar, Row, Screen } from '../../components/UI';
import { RANKS, rankFor } from '../../game/ranks';
import { useProgress } from '../../state/progress';
import { useAccent } from '../../state/settings';
import { colors, fonts } from '../../theme';
import { formatNumber } from '../../utils/date';

function RankDot({ color, size = 28, dim }: { color: string; size?: number; dim?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={11} fill="none" stroke={dim ? colors.ringSlot : color} strokeWidth={4} />
      <Circle cx={14} cy={14} r={4} fill={dim ? colors.ringSlot : color} />
    </Svg>
  );
}

export default function Ranks() {
  const accent = useAccent();
  const best = useProgress((s) => s.best);
  const topRuns = useProgress((s) => s.topRuns);
  const totalGames = useProgress((s) => s.totalGames);
  const totalGates = useProgress((s) => s.totalGates);
  const totalPerfects = useProgress((s) => s.totalPerfects);
  const { tier, next, progress } = rankFor(best);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Row style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            Gate Runner ranks
          </AppText>
        </Row>

        <Card style={styles.current}>
          <Row style={{ gap: 14 }}>
            <RankDot color={tier.color} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">Your rank</AppText>
              <AppText variant="heading" color={tier.color}>
                {tier.name}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="label">Best</AppText>
              <AppText style={styles.big}>{best}</AppText>
            </View>
          </Row>
          {next ? (
            <View style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="label">Next: {next.name}</AppText>
                <AppText variant="label" color={colors.textSoft}>
                  {next.min - best} gates to go
                </AppText>
              </Row>
              <ProgressBar value={progress} height={8} color={next.color} />
            </View>
          ) : (
            <AppText>Top rank reached. Legendary timing.</AppText>
          )}
        </Card>

        <View style={styles.statsRow}>
          <Mini value={formatNumber(totalGames)} label="Runs" />
          <Mini value={formatNumber(totalGates)} label="Gates" />
          <Mini value={formatNumber(totalPerfects)} label="Perfects" />
        </View>

        <AppText variant="overline">LADDER</AppText>
        <Card style={{ gap: 14 }}>
          {RANKS.map((r) => {
            const reached = best >= r.min;
            return (
              <Row key={r.id} style={{ gap: 12 }}>
                <RankDot color={r.color} dim={!reached} />
                <AppText variant="bodyStrong" style={{ flex: 1 }} color={reached ? colors.text : colors.textFaint}>
                  {r.name}
                </AppText>
                <AppText variant="label">{r.min === 0 ? 'Start' : `${r.min}+ gates`}</AppText>
              </Row>
            );
          })}
        </Card>

        <AppText variant="overline">PERSONAL TOP 10</AppText>
        <Card style={{ gap: 12 }}>
          {topRuns.length === 0 ? (
            <AppText>No runs yet. Your best scores will show up here.</AppText>
          ) : (
            topRuns.map((run, i) => (
              <Row key={run.at} style={{ gap: 12 }}>
                <AppText style={[styles.pos, i === 0 && { color: accent }]}>{i + 1}</AppText>
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {run.score} gates
                </AppText>
                <AppText variant="label">
                  ×{run.topSpeed.toFixed(1)} · {new Date(run.at).toLocaleDateString()}
                </AppText>
              </Row>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.mini}>
      <AppText style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  header: { height: 44 },
  current: { gap: 18, padding: 20, borderRadius: 28 },
  big: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  statsRow: { flexDirection: 'row', gap: 10 },
  mini: { flex: 1, alignItems: 'center', gap: 6 },
  miniValue: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  pos: { fontFamily: fonts.display, fontSize: 15, width: 24, color: colors.textFaint },
});
