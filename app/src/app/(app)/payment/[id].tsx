/**
 * NEW · Receipt: one payment from your history — project, editor, which part,
 * date, status, the 5% service fee and the total.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { payments, usd } from '@/lib/me';
import { useProjects } from '@/providers/projects-provider';

function fullDate(iso: string) {
  const d = new Date(iso);
  return `${d.toDateString().slice(4, 10)}, ${d.getFullYear()} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { projects } = useProjects();
  const x = payments(projects).find((p) => p.id === id);

  if (!x) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <PageTop title="Receipt" />
        <Text style={[styles.meta, { textAlign: 'center', marginTop: 40 }]}>This payment isn&apos;t here anymore.</Text>
      </View>
    );
  }

  const fee = Math.round(x.amount * 5) / 100;
  const part = x.part === 'upfront' ? (x.project.upfront_percent === 50 ? 'First half' : `Up front · ${x.project.upfront_percent}%`) : `On approval · ${100 - x.project.upfront_percent}%`;
  const rows: [string, string][] = [
    ['Project', x.project.name],
    ['Editor', x.editor],
    ['Part', part],
    ['Date', fullDate(x.date)],
    ['Paid with', 'Apple Pay'],
    ['Amount', usd(x.amount)],
    ['Service fee 5%', usd(fee)],
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Receipt" sub={`${x.project.name} · ${part}`} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, styles.hero]}>
          <Avatar k={x.editorKey} size={40} />
          <Text style={styles.big}>{usd(x.amount + fee)}</Text>
          <Text style={styles.meta}>to {x.editor} · held by Duoreels</Text>
          <Tag label={x.part === 'upfront' ? 'Paid · held' : 'Released'} tone={x.part === 'upfront' ? 'grey' : 'violet'} height={24} style={{ alignSelf: 'center', marginTop: 8 }} />
        </View>

        <View style={[styles.card, { marginTop: 14 }]}>
          {rows.map(([a, b], i) => (
            <View key={a} style={[styles.row, i > 0 && styles.rowLine]}>
              <Text style={[styles.t15, styles.flex]}>{a}</Text>
              <Text style={a === 'Amount' || a === 'Service fee 5%' ? styles.mono : styles.val} numberOfLines={1}>
                {b}
              </Text>
            </View>
          ))}
          <View style={[styles.row, styles.rowLine]}>
            <Text style={[styles.rowTitle, styles.flex]}>Total</Text>
            <Text style={[styles.mono, { fontFamily: Font.mono, color: Color.white }]}>{usd(x.amount + fee)}</Text>
          </View>
        </View>

        <Text style={[styles.meta, { marginTop: 14 }]}>
          {x.part === 'upfront'
            ? `Duoreels holds this until you approve. ${x.editor} gets it with the rest when the final is approved.`
            : `Released to ${x.editor} the moment you approved the final.`}
        </Text>

        <Pressable accessibilityRole="button" onPress={() => router.push(`/project/${x.project.id}`)} style={({ pressed }) => [styles.card, styles.row, { marginTop: 14 }, pressed && styles.rowPressed]}>
          <Icon name="projects" size={22} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Open {x.project.name}</Text>
          </View>
          <Icon name="chev" size={18} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, marginTop: 4, gap: 2 },
  big: { fontFamily: Font.display, fontSize: 44, lineHeight: 48, paddingTop: 4, color: Color.white, marginTop: 8 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 20, color: Color.text2 },
  val: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white, maxWidth: '60%' },
  mono: { fontFamily: Font.mono, fontSize: 14, lineHeight: 20, color: Color.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
});
