/**
 * Editor view · Join (prototype V.join): "<creator> invited you", the brief,
 * references, terms, then Accept / Suggest changes / Decline.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton } from '@/components/brand/bits';
import { PageTop } from '@/components/brand/top-bar';
import { FootageSection, ReferencesSection } from '@/components/project/files';
import { Color, Font, Space } from '@/constants/brand';
import { addDays, editorFull } from '@/lib/review';
import { firstCutLabel } from '@/lib/dates';
import { weekday } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

const slide = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(550);

type Invite = { id: string; project_id: string; editor_key: string };
function SuggestSheet({ price, due, me, onSend }: { price: number; due: string | null; me: string; onSend: (text: string) => void }) {
  const [why, setWhy] = useState('');
  return (
    <View>
      <Text style={styles.t20}>Suggest changes</Text>
      <View style={styles.listCard}>
        <View style={styles.row}>
          <Text style={[styles.t15, styles.flex]}>Price</Text>
          <Text style={styles.lab}>
            ${price} → ${price + 10}
          </Text>
        </View>
        <View style={[styles.row, styles.rowLine]}>
          <Text style={[styles.t15, styles.flex]}>First cut</Text>
          <Text style={styles.lab}>
            {weekday(due)} → {weekday(addDays(due, 1))}
          </Text>
        </View>
      </View>
      <TextInput
        value={why}
        onChangeText={setWhy}
        multiline
        placeholder="Why? Keep it short."
        placeholderTextColor={Color.meta}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        style={styles.area}
      />
      <BigButton label={`Send to ${me}`} onPress={() => onSend(why.trim())} style={{ marginTop: 14 }} />
    </View>
  );
}

export default function JoinScreen() {
  const { invite: inviteId } = useLocalSearchParams<{ invite: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { refreshProject } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const p = useProject(invite?.project_id);
  const me = profile?.name || 'Your creator';

  useEffect(() => {
    supabase
      .from('invites')
      .select('id, project_id, editor_key')
      .eq('id', inviteId)
      .maybeSingle()
      .then(({ data }) => setInvite(data as Invite | null));
  }, [inviteId]);

  if (!invite || !p) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <PageTop title="" backIcon="close" />
        <Text style={[styles.meta, { textAlign: 'center', marginTop: 40 }]}>{invite === null ? 'This invite isn’t here anymore.' : 'Loading…'}</Text>
      </View>
    );
  }

  const up = p.upfront_percent;
  const terms: [string, string, string?][] = [
    ['Price', `$${p.price ?? 75}`],
    ['Rounds', String(p.rounds)],
    ['First cut due', p.first_cut_at ? firstCutLabel(new Date(p.first_cut_at)) : weekday(p.due_date)],
    ['You get paid', `${up}% · ${100 - up}%`, 'when you start · on approval'],
  ];
  const ed = editorFull(invite.editor_key);

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_demo_invite', { invite_id: inviteId });
    setBusy(false);
    if (error) {
      toast("Couldn't accept · run 009 in Supabase, or check your connection");
      return;
    }
    await supabase.from('activity').insert({ project_id: p!.id, by_key: invite!.editor_key, title: `${ed.split(' ')[0]} joined ${p!.name}`, body: `${ed.split(' ')[0]} accepted your invite.`, action: 'review', unread: true });
    refreshProject(p!.id);
    router.back();
    setTimeout(() => toast(`Joined ${p!.name} · first cut due ${weekday(p!.due_date)}`), 400);
  }

  async function decline() {
    await supabase.from('invites').delete().eq('id', inviteId);
    router.back();
    setTimeout(() => toast(`Declined ${p!.name}`), 400);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="" backIcon="close" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <Animated.View entering={slide} style={styles.head}>
          <Avatar k="M" size={44} />
          <View>
            <Text style={styles.t20b}>{me} invited you</Text>
            <Text style={styles.meta}>{p.name}</Text>
          </View>
        </Animated.View>

        <Text style={styles.lbl}>THE BRIEF</Text>
        <View style={[styles.card, { padding: 14 }]}>
          <Text style={styles.t15}>{p.brief || 'No brief yet. Ask in a message.'}</Text>
        </View>

        {/* Same sections as project details: tap to watch, links open in the browser. */}
        <Text style={styles.lbl}>REFERENCES</Text>
        <ReferencesSection projectId={p.id} />

        <Text style={styles.lbl}>FOOTAGE</Text>
        <FootageSection projectId={p.id} />

        <Text style={styles.lbl}>TERMS</Text>
        <View style={styles.card}>
          {terms.map(([a, b, sub], i) => (
            <View key={a} style={[styles.row, i > 0 && styles.rowLine]}>
              <View style={styles.flex}>
                <Text style={styles.t15}>{a}</Text>
                {sub && <Text style={styles.meta}>{sub}</Text>}
              </View>
              <Text style={styles.lab}>{b}</Text>
            </View>
          ))}
        </View>

        <BigButton label="Accept" loading={busy} onPress={accept} style={{ marginTop: 22 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <BigButton
            label="Suggest changes"
            tone="control"
            style={styles.flex}
            onPress={() =>
              openSheet(
                <SuggestSheet
                  price={p.price ?? 75}
                  due={p.due_date}
                  me={me}
                  onSend={async (why) => {
                    closeSheet();
                    const body = `Could we do $${(p.price ?? 75) + 10} and first cut ${weekday(addDays(p.due_date, 1))}?${why ? ` ${why}` : ''}`;
                    await supabase.from('messages').insert({ editor_key: invite.editor_key, from_me: false, body });
                    await supabase.from('activity').insert({ project_id: p.id, by_key: invite.editor_key, title: `${ed.split(' ')[0]} suggested changes`, body, action: 'thread', unread: true });
                    toast(`Sent to ${me} · they can accept or reply`);
                  }}
                />,
              )
            }
          />
          <BigButton label="Decline" tone="control" style={styles.flex} onPress={decline} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 4, marginBottom: 12 },
  t20b: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  listCard: { borderRadius: 12, backgroundColor: Color.control, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  area: { minHeight: 80, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, textAlignVertical: 'top' },
});
