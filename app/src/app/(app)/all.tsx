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

import { BigButton, Chip, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { DeleteProjectsSheet } from '@/components/home/project-sheet';
import { Color, Font, Space } from '@/constants/brand';
import { editorName, finishedLabel, mmss, tagFor, useCover, type Project } from '@/lib/projects';
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

function GCard({ p, selecting, picked, onToggle }: { p: Project; selecting: boolean; picked: boolean; onToggle: () => void }) {
  const src = useCover(p);
  const [tag, tone] = tagFor(p);
  return (
    <Pressable
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: picked } : undefined}
      accessibilityLabel={p.name}
      onPress={selecting ? onToggle : () => router.push(`/project/${p.id}`)}
      style={styles.gcard}>
      <View style={[styles.thumb, picked && styles.thumbPicked]}>
        {src && <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {selecting && <View style={[styles.selc, picked && styles.selcOn]}>{picked && <Icon name="check" size={14} strokeWidth={2.6} color={Color.black} />}</View>}
        {!tag.startsWith('WAITING') && p.status !== 'done' && <Tag label={tag} tone={tone} height={20} style={styles.gtag} />}
        <View style={styles.dur}>
          <Text style={styles.durText}>{mmss(p.duration_seconds)}</Text>
        </View>
      </View>
      <Text style={styles.gtitle} numberOfLines={1}>
        {p.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {p.type} · {p.status === 'done' ? finishedLabel(p) : p.turn === 'me' ? 'Your turn' : `Waiting on ${editorName(p)}`}
      </Text>
    </Pressable>
  );
}

function FilterSheet({ projects, value, onShow }: { projects: Project[]; value: Filter; onShow: (f: Filter) => void }) {
  const [f, setF] = useState(value);
  const n = filtered(projects, f).length;
  const chip = (on: boolean, label: string, onPress: () => void) => <Chip key={label} label={label} on={on} onPress={onPress} />;
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
  /** Select mode (prototype S.sel): null = off. */
  const [sel, setSel] = useState<string[] | null>(null);
  const { removeLater } = useProjects();
  const { toast } = useOverlay();

  function askDelete() {
    if (!sel?.length) return;
    const ids = [...sel];
    const names = ids.map((id) => projects.find((p) => p.id === id)?.name ?? 'Project');
    openSheet(
      <DeleteProjectsSheet
        names={names}
        onKeep={closeSheet}
        onDelete={() => {
          closeSheet();
          setSel(null);
          // Hidden now; really deleted (rows + files) after 5 s unless you tap Undo.
          const undo = removeLater(ids, 5000, (msg) => toast(msg));
          toast(ids.length === 1 ? `${names[0]} deleted` : `${ids.length} projects deleted`, undo, true, 5000);
        }}
      />,
    );
  }

  const list = useMemo(() => filtered(projects, f).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [projects, f, q]);
  const active = [...(f.status !== 'all' ? [f.status === 'done' ? 'Done' : 'In progress'] : []), ...f.types];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop
        title=""
        right={
          <Pressable accessibilityRole="button" onPress={() => setSel((x) => (x ? null : []))} hitSlop={8} style={{ paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' }}>
            <Text style={styles.lab}>{sel ? 'Cancel' : 'Select'}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: (sel ? 120 : 50) + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.ptitle}>ALL PROJECTS</Text>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.lab}>
              {gb(storage.total)} of {PLANS[plan].gbLabel}
            </Text>
            <Chip label="More space" on height={28} onPress={() => router.push('/plan')} />
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(storage.total ? 1 : 0, Math.min(100, (storage.total / (PLANS[plan].gb * 1e9)) * 100))}%` }]} />
          </View>
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={Color.meta} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search your projects" placeholderTextColor={Color.meta} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.searchInput} />
        </View>

        <View style={styles.sec}>
          <Text style={styles.lab}>
            {list.length} projects · {f.sort}
          </Text>
          <Chip
            icon="filter"
            label={`Filter${active.length ? ` · ${active.length}` : ''}`}
            on={active.length > 0}
            height={30}
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
          />
        </View>
        {active.length > 0 && (
          <View style={[styles.chips, { marginTop: -2, marginBottom: 14 }]}>
            {active.map((a) => (
              <Chip key={a} label={a} height={28} accessibilityLabel={`Remove ${a}`} onPress={() => setF({ status: 'all', types: [], sort: 'Newest' })}>
                <Icon name="close" size={13} strokeWidth={2} />
              </Chip>
            ))}
          </View>
        )}

        <View style={styles.grid}>
          {list.map((p) => (
            <GCard
              key={p.id}
              p={p}
              selecting={!!sel}
              picked={!!sel?.includes(p.id)}
              onToggle={() => setSel((x) => (x ? (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]) : x))}
            />
          ))}
        </View>
        {!list.length && <Text style={styles.empty}>Nothing matches. Try another filter.</Text>}
      </ScrollView>
      {sel && (
        <View style={[styles.selbar, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
          <Text style={styles.lab}>{sel.length} selected</Text>
          <Pressable accessibilityRole="button" disabled={!sel.length} onPress={askDelete} style={({ pressed }) => [styles.delBtn, !sel.length && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
            <Icon name="trash" size={18} color={Color.black} />
            <Text style={styles.delText}>DELETE</Text>
          </Pressable>
        </View>
      )}
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
  seg: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 16 },
  gcard: { width: '31.9%' },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: Color.surface },
  thumbPicked: { borderWidth: 2, borderColor: Color.violet },
  selc: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Color.white, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  selcOn: { backgroundColor: Color.violet, borderColor: Color.violet },
  selbar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 16, backgroundColor: 'rgba(10,10,12,0.94)', borderTopWidth: 1, borderTopColor: '#222' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: Color.violet },
  delText: { fontFamily: Font.display, fontSize: 21, lineHeight: 26, paddingTop: 2, letterSpacing: 0.4, color: Color.black },
  gtag: { position: 'absolute', left: 6, top: 8 },
  dur: { position: 'absolute', left: 6, bottom: 6, height: 20, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.white },
  gtitle: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white, marginTop: 6 },
  empty: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, textAlign: 'center', paddingVertical: 30 },
});
