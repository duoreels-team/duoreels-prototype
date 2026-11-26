/**
 * Payments and earnings (prototype V.payments), from your real projects:
 * this month, waiting on approval, history (tap → receipt), Pay with.
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { moneySummary, usd } from '@/lib/me';
import { shortDate } from '@/lib/review';
import { useProjects } from '@/providers/projects-provider';

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const { projects } = useProjects();
  const m = moneySummary(projects);
  const split = projects.find((p) => p.price && !p.is_sample)?.upfront_percent ?? 50;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Payments and earnings" sub={split === 50 ? 'Half up front, half on approval' : `${split}% up front, ${100 - split}% on approval`} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { padding: 16, marginTop: 4 }]}>
          <Text style={styles.meta}>This month</Text>
          <Text style={styles.big}>{usd(m.paidThisMonth)}</Text>
          <Text style={styles.meta}>
            {usd(m.waitingAmount)} waiting on your approval · {m.waitingCount} project{m.waitingCount === 1 ? '' : 's'}
          </Text>
        </View>

        <Text style={styles.sec}>HISTORY</Text>
        <View style={styles.card}>
          {m.list.length === 0 && <Text style={[styles.meta, { padding: 14 }]}>Nothing paid yet. Payments show up here when a project starts.</Text>}
          {m.list.map((x, i) => (
            <Pressable key={x.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/payment/[id]', params: { id: x.id } })} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.rowPressed]}>
              <Avatar k={x.editorKey} size={32} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {x.project.name}
                </Text>
                <Text style={styles.meta}>
                  {x.label} · {shortDate(x.date)}
                </Text>
              </View>
              <Text style={styles.mono}>{usd(x.amount)}</Text>
              <Icon name="chev" size={16} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.sec}>PAY WITH</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/pay-with')} style={({ pressed }) => [styles.card, styles.row, pressed && styles.rowPressed]}>
          <Icon name="money" size={22} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Apple Pay</Text>
            <Text style={styles.meta}>Default</Text>
          </View>
          <Icon name="chev" size={18} />
        </Pressable>
        <Text style={[styles.meta, { marginTop: 14 }]}>Duoreels holds the money and releases it the moment a round is approved. Service fee 5%.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  big: { fontFamily: Font.display, fontSize: 44, lineHeight: 48, paddingTop: 4, color: Color.white, marginVertical: 2 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  mono: { fontFamily: Font.mono, fontSize: 14, lineHeight: 20, color: Color.white },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
});
