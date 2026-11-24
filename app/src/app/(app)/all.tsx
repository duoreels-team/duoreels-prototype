/**
 * All projects (prototype V.all + filterSheet): storage card, search,
 * "N projects · Newest" + Filter, active filter chips, 3-per-row grid.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { editorName, mmss, tagFor, useCover, type Project } from '@/lib/projects';
import { gb, planOf, PLANS, useStorage } from '@/lib/me';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

type Filter = { status: 'all' | 'in_progress' | 'done'; types: string[]; sort: 'Newest' | 'Deadline' | 'Last change' };
const TYPES = ['Vlog', 'Food', 'Talking head', 'Product', 'Travel'];

function filtered(list: Project[], f: Filter) {
  let l = list.filter((p) => f.status === 'all' || p.status === f.status);
  if (f.types.length) l = l.filter((p) => f.types.includes(p.type));
  if (f.sort === 'Deadline') l = [...l].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  return l;
}

function GCard({ p }: { p: Project }) {
  const src = useCover(p);
  const [tag, tone] = tagFor(p);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push(`/project/${p.id}`)} style={styles.gcard}>
      <View style={styles.thumb}>
        {src && <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {!tag.startsWith('WAITING') && <Tag label={tag} tone={tone} height={20} style={styles.gtag} />}
        <View style={styles.dur}>
          <Text style={styles.durText}>{mmss(p.duration_seconds)}</Text>
        </View>
      </View>
      <Text style={styles.gtitle} numberOfLines={1}>
        {p.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {p.type} · {p.status === 'done' ? 'Done' : p.turn === 'me' ? 'Your turn' : `Waiting on ${editorName(p)}`}
      </Text>
    </Pressable>
  );
}

function FilterSheet({ projects, value, onShow }: { projects: Project[]; value: Filter; onShow: (f: Filter) => void }) {
  const [f, setF] = useState(value);
  const n = filtered(projects, f).length;
  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: Color.black }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 }}>
        <Text style={[styles.t20, { flex: 1 }]}>Filter</Text>
        <Pressable accessibilityRole="button" onPress={() => setF({ status: 'all', types: [], sort: 'Newest' })} hitSlop={10}>
          <Text style={[styles.lab, { color: Color.meta }]}>Clear</Text>
        </Pressable>
      </View>
      <Text style={styles.lbl}>STATUS</Text>
      <View style={styles.chips}>
        {(
          [
            ['all', 'All'],
            ['in_progress', 'In progress'],
            ['done', 'Done'],
          ] as const
        ).map(([v, l]) => chip(f.status === v, `${l} ${projects.filter((p) => v === 'all' || p.status === v).length}`, () => setF({ ...f, status: v })))}
      </View>
      <Text style={styles.lbl}>TYPE · PICK ANY</Text>
      <View style={styles.chips}>
        {TYPES.map((t) =>
          chip(f.types.includes(t), `${t} ${projects.filter((p) => p.type === t).length}`, () => setF({ ...f, types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] })),
        )}
      </View>
      <Text style={styles.lbl}>SORT</Text>
      <View style={styles.seg}>
        {(['Newest', 'Deadline', 'Last change'] as const).map((s) => (
          <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: f.sort === s }} onPress={() => setF({ ...f, sort: s })} style={[styles.segBtn, f.sort === s && styles.segOn]}>
            <Text style={[styles.segText, f.sort === s && { color: Color.black }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 20 }}>
        <BigButton label={`Show ${n} project${n === 1 ? '' : 's'}`} disabled={!n} onPress={() => onShow(f)} />
      </View>
    </View>
  );
}

export default function AllProjectsScreen() {
  const { profile } = useAuth();
  const storage = useStorage();
  const plan = planOf(profile);
  const { status } = useLocalSearchParams<{ status?: string }>();
  const insets = useSafeAreaInsets();
  const { projects } = useProjects();
  const { openSheet, closeSheet } = useOverlay();
  const [f, setF] = useState<Filter>({ status: status === 'done' ? 'done' : status === 'progress' ? 'in_progress' : 'all', types: [], sort: 'Newest' });
  const [q, setQ] = useState('');

  const list = useMemo(() => filtered(projects, f).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [projects, f, q]);
  const active = [...(f.status !== 'all' ? [f.status === 'done' ? 'Done' : 'In progress'] : []), ...f.types];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      {/* "Select" doesn't do anything in the prototype yet. */}
      <PageTop title="" right={<Text style={[styles.lab, { paddingHorizontal: 8 }]}>Select</Text>} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 50 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.ptitle}>ALL PROJECTS</Text>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.lab}>
              {gb(storage.total)} of {PLANS[plan].gbLabel}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={styles.more}>
              <Text style={[styles.chipText, { color: Color.black }]}>More space</Text>
            </Pressable>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(storage.total ? 1 : 0, Math.min(100, (storage.total / (PLANS[plan].gb * 1e9)) * 100))}%` }]} />
          </View>
          <Text style={styles.meta}>Finished projects clear after {plan === 'free' ? '60 days' : '1 year'}</Text>
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={Color.meta} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search your projects" placeholderTextColor={Color.meta} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.searchInput} />
        </View>

        <View style={styles.sec}>
          <Text style={styles.lab}>
            {list.length} projects · {f.sort}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              openSheet(
                <FilterSheet
                  projects={projects}
                  value={f}
                  onShow={(next) => {
                    setF(next);
                    closeSheet();
                  }}
                />,
              )
            }
            style={[styles.chip, { height: 30, flexDirection: 'row', gap: 4, alignItems: 'center' }, active.length > 0 && styles.chipOn]}>
            <Icon name="filter" size={16} color={active.length ? Color.black : Color.white} />
            <Text style={[styles.chipText, active.length > 0 && { color: Color.black }]}>Filter{active.length ? ` · ${active.length}` : ''}</Text>
          </Pressable>
        </View>
        {active.length > 0 && (
          <View style={[styles.chips, { marginTop: -2, marginBottom: 14 }]}>
            {active.map((a) => (
              <Pressable key={a} accessibilityRole="button" onPress={() => setF({ status: 'all', types: [], sort: 'Newest' })} style={[styles.chip, { height: 28, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Text style={styles.chipText}>{a}</Text>
                <Icon name="close" size={13} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.grid}>
          {list.map((p) => (
            <GCard key={p.id} p={p} />
          ))}
        </View>
        {!list.length && <Text style={styles.empty}>Nothing matches. Try another filter.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  ptitle: { fontFamily: Font.display, fontSize: 48, lineHeight: 50, paddingTop: 4, letterSpacing: 0.24, color: Color.white },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  card: { padding: 14, marginTop: 16, borderRadius: 12, backgroundColor: Color.surface },
  more: { height: 28, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Color.white, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { height: 4, borderRadius: 4, backgroundColor: Color.control, overflow: 'hidden', marginTop: 12, marginBottom: 8 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: Color.violet },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, marginTop: 14, borderRadius: 8, backgroundColor: Color.surface },
  searchInput: { flex: 1, minWidth: 0, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42', justifyContent: 'center' },
  chipOn: { backgroundColor: Color.white, borderColor: Color.white },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  seg: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 16 },
  gcard: { width: '31.9%' },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: Color.surface },
  gtag: { position: 'absolute', left: 6, top: 8 },
  dur: { position: 'absolute', left: 6, bottom: 6, height: 20, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.white },
  gtitle: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white, marginTop: 6 },
  empty: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, textAlign: 'center', paddingVertical: 30 },
});
