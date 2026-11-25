/**
 * Editor view · Home (prototype V['ed-home']). You play your demo editor on your
 * own projects: invites you sent show up as "<you> invited you", projects where
 * it's the editor's turn are the big cards, the rest wait on you.
 */
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Cover34, IconButton, Section, Tag } from '@/components/brand/bits';
import { LogoButton } from '@/components/brand/role-sheet';
import { StripeHeader } from '@/components/brand/stripe-header';
import { Icon } from '@/components/brand/icons';
import { Color, Font, Space } from '@/constants/brand';
import { moneySummary, usd } from '@/lib/me';
import { dotDate, editorName, weekday, type Project } from '@/lib/projects';
import { money } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useProjects } from '@/providers/projects-provider';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const slideIn = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
  })
    .duration(550)
    .delay(i * 40);

export type PendingInvite = { id: string; project_id: string; editor_key: string; created_at: string };

export function usePendingInvites() {
  const [list, setList] = useState<PendingInvite[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('invites').select('id, project_id, editor_key, created_at').eq('status', 'pending').not('editor_key', 'is', null).order('created_at', { ascending: false });
    setList((data as PendingInvite[]) ?? []);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return { list, reload: load };
}

export function EditorHome() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const invites = usePendingInvites();
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const me = profile?.name || 'Your creator';

  // Projects you've accepted (no pending invite) are yours to edit.
  const pendingIds = useMemo(() => new Set(invites.list.map((i) => i.project_id)), [invites.list]);
  const inProgress = projects.filter((p) => p.status === 'in_progress' && !p.is_draft && !pendingIds.has(p.id));
  const yourTurn = inProgress.filter((p) => p.turn === 'them' && !p.asks_extra_day);
  const waiting = inProgress.filter((p) => p.turn === 'me' || p.asks_extra_day);
  const done = projects.filter((p) => p.status === 'done').slice(0, 8);
  const invite = invites.list[0];
  const inviteProject = invite ? projects.find((p) => p.id === invite.project_id) : null;
  const earned = moneySummary(projects).paidThisMonth;

  // Open notes per project (what the creator sent and the editor hasn't ticked).
  useEffect(() => {
    let live = true;
    const ids = yourTurn.map((p) => p.id);
    if (!ids.length) return;
    supabase
      .from('versions')
      .select('id, project_id, notes(id, status, done, by_key, kind)')
      .in('project_id', ids)
      .then(({ data }) => {
        if (!live) return;
        const counts: Record<string, number> = {};
        for (const v of (data as { project_id: string; notes: { status: string; done: boolean; by_key: string; kind: string }[] }[]) ?? []) {
          counts[v.project_id] = (counts[v.project_id] ?? 0) + v.notes.filter((n) => n.status === 'sent' && !n.done && n.by_key === 'M' && n.kind !== 'pin').length;
        }
        setOpenCounts(counts);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourTurn.map((p) => p.id).join(',')]);

  function bigSub(p: Project) {
    const n = openCounts[p.id] ?? 0;
    const next = `v${p.current_version + 1}`;
    if (!p.current_version) return `First cut due ${weekday(p.due_date)}`;
    return n ? `${n} note${n === 1 ? '' : 's'} from ${me} · ${next} due ${weekday(p.due_date)}` : `${next} due ${weekday(p.due_date)}`;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 54, paddingBottom: 110 }}>
        <StripeHeader />
        <View style={styles.pad}>
          {invite && inviteProject && (
            <Animated.View entering={slideIn(0)}>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/join/${invite.id}`)} style={styles.inviteCard}>
                <LinearGradient colors={[Color.surface, '#1A1430']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Avatar k="M" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{me} invited you</Text>
                  <Text style={styles.meta}>
                    {inviteProject.name} · ${inviteProject.price ?? 75} · {inviteProject.rounds} rounds
                  </Text>
                </View>
                <Icon name="chev" size={18} />
              </Pressable>
            </Animated.View>
          )}

          <Section title={`In progress · ${inProgress.length}`} action="See all ›" onAction={() => router.push({ pathname: '/all', params: { status: 'progress' } })} style={{ marginTop: 24 }} />

          {yourTurn.map((p, i) => (
            <Animated.View key={p.id} entering={slideIn(i + 1)}>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/ed-project/${p.id}`)} style={({ pressed }) => [styles.prow, pressed && { transform: [{ scale: 0.985 }] }]}>
                <Tag label="Your turn" tone="violet" style={styles.rtag} />
                <Cover34 project={p} width={76} />
                <View style={styles.prowTx}>
                  <Text style={styles.prowTitle} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta}>
                    v{Math.max(p.current_version, 1)} · {me} · due {dotDate(p.due_date)}
                  </Text>
                  <View style={styles.s}>
                    <Avatar k="M" size={18} />
                    <Text style={styles.sText} numberOfLines={1}>
                      {bigSub(p)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}

          {waiting.length > 0 && (
            <View style={[styles.list, { marginTop: yourTurn.length ? 18 : 0 }]}>
              {waiting.map((p, i) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/ed-project/${p.id}`)} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.rowPressed]}>
                  <Cover34 project={p} width={40} radius={6} showTime={false} />
                  <View style={styles.flex}>
                    <Text style={styles.wrowTitle} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {p.asks_extra_day ? 'Asked for +1 day · waiting on the answer' : p.new_version ? `v${p.current_version} sent · ${me} is reviewing` : `Waiting on ${me}’s answer`}
                    </Text>
                  </View>
                  <Avatar k="M" size={24} />
                </Pressable>
              ))}
            </View>
          )}
          {inProgress.length === 0 && <Text style={[styles.meta, { textAlign: 'center', paddingVertical: 24 }]}>Nothing needs you now.</Text>}

          <View style={styles.sec}>
            <Text style={styles.secText}>DONE · {done.length}</Text>
            <Text style={styles.meta}>{usd(earned)} this month</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {done.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/ed-project/${p.id}`)} style={{ width: 112 }}>
                <Cover34 project={p} width={112} radius={10} />
                <Text style={[styles.lab, { marginTop: 7 }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.meta}>Paid {usd(money(p).price)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.meta, { marginTop: 18 }]}>Editor view · you&apos;re playing {editorName(yourTurn[0] ?? waiting[0] ?? projects[0] ?? ({ editor_keys: ['L'] } as unknown as Project))} on your own projects.</Text>
        </View>
      </ScrollView>
      <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <LogoButton />
          </View>
          <IconButton name="bell" label="Activity" onPress={() => router.push('/activity')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  fixedTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10 },
  wm: { flex: 1, fontFamily: Font.display, fontSize: 30, lineHeight: 34, paddingTop: 2, letterSpacing: 0.6, color: Color.white },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, overflow: 'hidden' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  prow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: Color.surface, borderRadius: 12, padding: 12, marginTop: 16 },
  rtag: { position: 'absolute', top: -9, right: 14, zIndex: 2 },
  prowTx: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 5 },
  prowTitle: { fontFamily: Font.semibold, fontSize: 17, lineHeight: 22, color: Color.white },
  s: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sText: { flex: 1, fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.text2 },
  list: { backgroundColor: Color.surface, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  wrowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  secText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta },
});
