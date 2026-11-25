/**
 * Editor profile (prototype V.editor): heart (saved for real), Share, Invite to a
 * project (inviteEd), message, Short / Long price cards, Reels / Reviews tabs,
 * rating bars, reviews, and the reel viewer.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, IconButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { ReelTile, Stars } from '@/components/market/bits';
import { ReelViewer } from '@/components/market/story';
import { Color, Font, Space } from '@/constants/brand';
import { reviewsOf, toggleSaved, useMarket } from '@/lib/market';
import { person } from '@/lib/people';
import { editorName, useCover, type Project } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';
import { Image } from 'expo-image';

const slide = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(550);

function ProjectThumb({ p }: { p: Project }) {
  const src = useCover(p);
  return <View style={styles.pthumb}>{src && <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>;
}

/** inviteEd: a new project with this editor, or one of your projects in progress. */
function InviteEditorSheet({ k }: { k: string }) {
  const { projects, refreshProject } = useProjects();
  const { closeSheet, toast } = useOverlay();
  const name = person(k).name;
  const mine = projects.filter((p) => p.status === 'in_progress').slice(0, 3);
  async function inviteTo(p: Project) {
    closeSheet();
    const { data: user } = await supabase.auth.getUser();
    const inv = await supabase.from('invites').insert({ project_id: p.id, editor_key: k, invited_by: user.user?.id, status: 'pending' });
    if (inv.error) {
      toast("Couldn't send the invite · check your connection");
      return;
    }
    if (!p.editor_keys.includes(k)) await supabase.from('projects').update({ editor_keys: [...p.editor_keys, k] }).eq('id', p.id);
    refreshProject(p.id);
    toast(`Invite sent to ${name} · ${p.name}`);
  }
  return (
    <View>
      <Text style={styles.t20}>Invite {name} to…</Text>
      <View style={styles.list}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            closeSheet();
            router.push({ pathname: '/new-project', params: { editor: k } });
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Icon name="plus" size={22} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>A new project</Text>
            <Text style={styles.meta}>Brief, price and rounds next</Text>
          </View>
          <Icon name="chev" size={18} />
        </Pressable>
        {mine.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => inviteTo(p)} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
            <ProjectThumb p={p} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.type} · with {editorName(p)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function EditorProfile() {
  const { k = 'L' } = useLocalSearchParams<{ k: string }>();
  const insets = useSafeAreaInsets();
  const market = useMarket();
  const { openSheet, toast } = useOverlay();
  const [tab, setTab] = useState<'reels' | 'reviews'>('reels');
  const [reel, setReel] = useState<number | null>(null);
  const e = market.editors.find((x) => x.key === k);
  const saved = market.saved.includes(k);

  if (!e) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <PageTop title="" />
        <Text style={[styles.meta, { textAlign: 'center', marginTop: 40 }]}>{market.status === 'loading' ? 'Loading…' : 'This editor isn’t here anymore.'}</Text>
      </View>
    );
  }

  const reviews = reviewsOf(k);
  const link = `https://duoreels.app/e/${e.name.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop
        title=""
        right={
          <>
            <IconButton
              name={saved ? 'heart-filled' : 'heart'}
              size={22}
              color={saved ? Color.violet : Color.white}
              label={saved ? 'Unsave editor' : 'Save editor'}
              onPress={async () => {
                const now = await toggleSaved(k);
                toast(now ? `${person(k).name} saved` : `${person(k).name} removed from Saved`);
              }}
            />
            <IconButton name="share" size={22} label="Share" onPress={() => Share.share({ message: `${e.name} on Duoreels · ${e.style}\n${link}`, url: link })} />
          </>
        }
      />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <Animated.View entering={slide} style={styles.head}>
          <Avatar k={k} size={64} />
          <View style={styles.flex}>
            <Text style={styles.t28}>{e.name}</Text>
            <Text style={styles.meta}>Short-form editor · {e.style}</Text>
            <Text style={styles.meta}>
              <Icon name="star" size={11} color={Color.violet} /> {e.stars.toFixed(1)} ({reviews.length}) · {e.projects} projects · replies in 1–2 h
            </Text>
          </View>
        </Animated.View>

        <View style={styles.ctaRow}>
          <BigButton label="Invite to a project" onPress={() => openSheet(<InviteEditorSheet k={k} />)} style={styles.flex} />
          <Pressable accessibilityRole="button" accessibilityLabel="Message" onPress={() => router.push(`/thread/${k}`)} style={styles.msgBtn}>
            <Icon name="chat" size={20} />
          </Pressable>
        </View>

        <View style={styles.prices}>
          <View style={styles.pricecard}>
            <Text style={styles.meta}>Short</Text>
            <Text style={styles.priceBig}>${e.price}</Text>
            <Text style={styles.meta}>≤ 60 s · 2 rounds</Text>
          </View>
          <View style={styles.pricecard}>
            <Text style={styles.meta}>Long</Text>
            <Text style={styles.priceBig}>${e.price + 80}</Text>
            <Text style={styles.meta}>1–5 min · 3 rounds</Text>
          </View>
        </View>

        <View style={styles.seg}>
          {(
            [
              ['reels', 'Reels'],
              ['reviews', `Reviews · ${reviews.length}`],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[styles.segBtn, tab === key && styles.segOn]}>
              <Text style={[styles.segText, tab === key && { color: Color.black }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'reels' ? (
          <View style={styles.grid}>
            {e.reels.map((r, i) => (
              <View key={r} style={styles.gridItem}>
                <ReelTile img={r} dur={e.durations[i]} onPress={() => setReel(i)} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={styles.revsum}>
              <View>
                <Text style={styles.bigStar}>{e.stars.toFixed(1)}</Text>
                <Stars n={Math.round(e.stars)} size={14} />
                <Text style={styles.meta}>{reviews.length} reviews</Text>
              </View>
              <View style={styles.flex}>
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = reviews.filter((r) => r.stars === n).length;
                  return (
                    <View key={n} style={styles.rbarrow}>
                      <Text style={styles.meta}>{n}</Text>
                      <View style={styles.rtrack}>
                        <View style={[styles.rfill, { width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }]} />
                      </View>
                      <Text style={[styles.meta, { width: 14, textAlign: 'right' }]}>{c}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            {reviews.map((r) => (
              <View key={r.id} style={styles.rev}>
                <View style={styles.revHead}>
                  <View style={[styles.revAv, { backgroundColor: r.color }]}>
                    <Text style={styles.revAvText}>{r.initial}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.lab}>{r.name}</Text>
                    <Text style={styles.meta}>
                      {r.project} · {r.date_label}
                    </Text>
                  </View>
                  <Stars n={r.stars} />
                </View>
                <Text style={styles.t15}>{r.body}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {reel !== null && <ReelViewer editor={e} start={reel} onClose={() => setReel(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  t28: { fontFamily: Font.bold, fontSize: 28, lineHeight: 32, color: Color.white },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 4, marginBottom: 12 },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, marginTop: 10 },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  msgBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Color.white, alignItems: 'center', justifyContent: 'center' },
  prices: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pricecard: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.surface },
  priceBig: { fontFamily: Font.display, fontSize: 30, lineHeight: 34, paddingTop: 2, color: Color.white, marginVertical: 2 },
  seg: { flexDirection: 'row', width: 220, marginTop: 16, backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  gridItem: { width: '31.9%' },
  revsum: { flexDirection: 'row', gap: 18, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: Color.surface },
  bigStar: { fontFamily: Font.display, fontSize: 44, lineHeight: 46, paddingTop: 2, color: Color.white },
  rbarrow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 18 },
  rtrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: Color.control, overflow: 'hidden' },
  rfill: { height: 5, backgroundColor: Color.violet },
  rev: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2E' },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  revAv: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  revAvText: { fontFamily: Font.bold, fontSize: 14, lineHeight: 14, color: Color.black, includeFontPadding: false },
  list: { backgroundColor: Color.surface, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  pthumb: { width: 36, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: Color.control },
});
