/**
 * Post to social (prototype V.post): cover + caption (AI write, Translate),
 * which apps, "Send N drafts". Saves the caption and apps, marks the project posted.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { logActivity } from '@/lib/flow';
import { useCover } from '@/lib/projects';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

const DEFAULT_CAPTION = 'Coffee first, phone later. What does your 5 am look like?\n#morningroutine #5amclub';
const AI_CAPTION = '5 am, one coffee, zero notifications. Here is how I start slow. ☕';
const AI_TAGS = '#morningroutine #slowliving';
const ZH_CAPTION = '早上 5 点，一杯咖啡，零通知。慢慢开始新的一天。☕\n#晨间日常 #慢生活';
const APPS: [string, string][] = [
  ['T', 'TikTok'],
  ['R', 'Reels'],
  ['S', 'Shorts'],
];

function splitCaption(c: string) {
  const lines = c.split('\n');
  const tags = lines.length > 1 && lines[lines.length - 1].trim().startsWith('#') ? lines.pop()! : '';
  return { text: lines.join('\n'), tags };
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const { update, refreshProject } = useProjects();
  const { toast } = useOverlay();
  const cover = useCover(p ?? { cover_image: null });
  const [caption, setCaption] = useState(p?.caption ?? DEFAULT_CAPTION);
  const [apps, setApps] = useState<string[]>(p?.post_apps ?? ['TikTok', 'Reels']);
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const shimmer = useSharedValue(1);

  useEffect(() => {
    shimmer.value = writing ? withRepeat(withSequence(withTiming(0.35, { duration: 450 }), withTiming(1, { duration: 450 })), -1) : withTiming(1);
  }, [writing, shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  if (!p) return null;
  const { text, tags } = splitCaption(caption);
  const n = apps.length;

  async function aiWrite() {
    setWriting(true);
    await new Promise((r) => setTimeout(r, 900));
    setWriting(false);
    for (let i = 0; i <= AI_CAPTION.length; i++) {
      setCaption(AI_CAPTION.slice(0, i));
      await new Promise((r) => setTimeout(r, 18));
    }
    setCaption(`${AI_CAPTION}\n${AI_TAGS}`);
  }

  async function sendDrafts() {
    if (!p || !n) return;
    setSending(true);
    const err = await update(id, { caption, post_apps: apps, done_kind: 'posted', posted_at: new Date().toISOString() });
    if (err) {
      setSending(false);
      toast(err);
      return;
    }
    await logActivity({ project_id: id, by_key: 'M', title: `You posted ${p.name}`, body: `${n} draft${n === 1 ? '' : 's'} sent · ${apps.join(', ')}`, tag: 'DONE', tag_tone: 'grey' });
    refreshProject(id);
    router.dismissAll();
    router.navigate('/');
    setTimeout(() => toast(`${n} drafts sent · open each app to post`), 300);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Post to social" sub="Optional · saves as drafts in each app" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 30 + insets.bottom }]}>
        <Text style={[styles.lbl, { marginTop: 6 }]}>COVER AND CAPTION</Text>
        <View style={styles.card}>
          <View>
            <View style={styles.thumb}>
              {cover && <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />}
              <Text style={styles.coverTitle} numberOfLines={2}>
                {p.cover_title ?? 'My 5 am routine'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/project/${id}/cover`)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 6 }}>
              <Text style={[styles.meta, { color: Color.white }]}>Edit cover</Text>
            </Pressable>
          </View>
          <View style={styles.flex}>
            <Animated.Text style={[styles.t15, styles.flex, shimmerStyle]}>
              {text}
              {tags ? <Text style={{ color: Color.violet }}>{`\n${tags}`}</Text> : null}
            </Animated.Text>
            <View style={styles.chipRow}>
              <Pressable accessibilityRole="button" onPress={aiWrite} disabled={writing} style={styles.chip}>
                <Icon name="spark" size={14} color={Color.violet} />
                <Text style={styles.chipText}>AI write</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setCaption(ZH_CAPTION)} style={styles.chip}>
                <Text style={styles.chipText}>Translate</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.lbl}>POST TO</Text>
        <View style={[styles.card, { gap: 14 }]}>
          {APPS.map(([k, name]) => {
            const on = apps.includes(name);
            return (
              <Pressable
                key={k}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={name}
                onPress={() => setApps((a) => (on ? a.filter((x) => x !== name) : [...a, name]))}
                style={styles.appBtn}>
                <View style={[styles.apt, { backgroundColor: on ? Color.white : Color.control }]}>
                  <Text style={[styles.aptText, { color: on ? Color.black : '#888888' }]}>{k}</Text>
                </View>
                <Text style={styles.appName}>{name}</Text>
              </Pressable>
            );
          })}
          {/* "More" doesn't open anything in the prototype yet. */}
          <View style={styles.appBtn}>
            <View style={[styles.apt, styles.aptMore]}>
              <Icon name="plus" size={20} color={Color.text2} />
            </View>
            <Text style={[styles.appName, { color: Color.text2 }]}>More</Text>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <BigButton label={`Send ${n} draft${n === 1 ? '' : 's'}`} disabled={!n} loading={sending} onPress={sendDrafts} />
        </View>
        <Text style={[styles.meta, { textAlign: 'center', marginTop: 10 }]}>Goes to each app&apos;s drafts. Add tags, mentions and music there.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, backgroundColor: Color.surface },
  thumb: { width: 96, height: 150, borderRadius: 8, overflow: 'hidden', backgroundColor: Color.control },
  coverTitle: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 96,
    padding: 4,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.7)',
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 17,
    textAlign: 'center',
    color: Color.white,
  },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42' },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  appBtn: { alignItems: 'center', gap: 6 },
  apt: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aptMore: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#3A3A42' },
  aptText: { fontFamily: Font.bold, fontSize: 18, lineHeight: 22 },
  appName: { fontFamily: Font.medium, fontSize: 14, lineHeight: 18, color: Color.white },
});
