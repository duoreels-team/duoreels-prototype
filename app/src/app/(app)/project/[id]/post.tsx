/**
 * Post to social (prototype V.post), with YOUR words only:
 * cover (from the project) + title, caption and hashtags you type (empty to start).
 * "AI write" and "Translate" fill the fields only when you tap them (Edge Function
 * "write"); everything stays editable and is saved on the project.
 * The app tiles use the official TikTok / Instagram / YouTube logos.
 */
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { logActivity } from '@/lib/flow';
import { spendCredits } from '@/lib/me';
import { useCover } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

// Official brand glyphs (Font Awesome brands), in each platform's own colours.
const APPS: { key: string; name: string; glyph: 'tiktok' | 'instagram' | 'youtube'; onTile: string; offTile: string }[] = [
  { key: 'TikTok', name: 'TikTok', glyph: 'tiktok', onTile: '#000000', offTile: '#FFFFFF' },
  { key: 'Reels', name: 'Reels', glyph: 'instagram', onTile: '#000000', offTile: '#FFFFFF' },
  { key: 'Shorts', name: 'Shorts', glyph: 'youtube', onTile: '#FF0000', offTile: '#FF0000' },
];

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const { update, refreshProject } = useProjects();
  const { toast } = useOverlay();
  const cover = useCover(p ?? { cover_image: null });
  const [title, setTitle] = useState(p?.cover_title ?? '');
  const [caption, setCaption] = useState(p?.caption ?? '');
  const [tags, setTags] = useState(p?.hashtags ?? '');
  const [apps, setApps] = useState<string[]>(p?.post_apps ?? ['TikTok', 'Reels']);
  const [busy, setBusy] = useState<'write' | 'translate' | null>(null);
  const [sending, setSending] = useState(false);

  if (!p) return null;
  const n = apps.length;

  const save = (fields: Record<string, unknown>) => update(id, fields);

  async function aiWrite() {
    if (!p) return;
    if (!(await spendCredits('ai_write', id))) {
      toast('No AI credits left · get more in Me', undefined, false);
      return;
    }
    setBusy('write');
    const { data, error } = await supabase.functions.invoke<{ caption: string; hashtags: string }>('write', {
      body: { mode: 'caption', name: p.name, type: p.type, brief: p.brief ?? '' },
    });
    setBusy(null);
    if (error || !data?.caption) {
      toast("AI write isn't set up yet · deploy the write function", undefined, false);
      return;
    }
    setCaption(data.caption);
    setTags(data.hashtags);
    save({ caption: data.caption, hashtags: data.hashtags || null });
  }

  async function translate() {
    const text = [caption.trim(), tags.trim()].filter(Boolean).join('\n');
    if (!text) {
      toast('Write a caption first', undefined, false);
      return;
    }
    if (!(await spendCredits('translate', id))) {
      toast('No AI credits left · get more in Me', undefined, false);
      return;
    }
    setBusy('translate');
    const { data, error } = await supabase.functions.invoke<{ text: string }>('write', { body: { mode: 'translate', text, to: 'Simplified Chinese' } });
    setBusy(null);
    if (error || !data?.text) {
      toast("Translate isn't set up yet · deploy the write function", undefined, false);
      return;
    }
    const lines = data.text.split('\n');
    const last = lines.length > 1 && lines[lines.length - 1].trim().startsWith('#') ? lines.pop()! : '';
    setCaption(lines.join('\n'));
    if (last) setTags(last);
    save({ caption: lines.join('\n'), hashtags: last || tags || null });
  }

  async function sendDrafts() {
    if (!p || !n) return;
    setSending(true);
    const err = await update(id, {
      cover_title: title.trim() || null,
      caption: caption.trim() || null,
      hashtags: tags.trim() || null,
      post_apps: apps,
      done_kind: 'posted',
      posted_at: new Date().toISOString(),
    });
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 30 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lbl, { marginTop: 6 }]}>COVER AND CAPTION</Text>
          <View style={styles.card}>
            <View>
              <View style={styles.thumb}>
                {cover && <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />}
                {!!title.trim() && (
                  <Text style={styles.coverTitle} numberOfLines={2}>
                    {title.trim()}
                  </Text>
                )}
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/project/${id}/cover`)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 6 }}>
                <Text style={[styles.meta, { color: Color.white }]}>Edit cover</Text>
              </Pressable>
            </View>
            <View style={[styles.flex, { gap: 8 }]}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                onBlur={() => save({ cover_title: title.trim() || null })}
                placeholder="Title on the cover"
                placeholderTextColor={Color.meta}
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                maxLength={60}
                accessibilityLabel="Title on the cover"
                style={styles.titleInput}
              />
              <TextInput
                value={caption}
                onChangeText={setCaption}
                onBlur={() => save({ caption: caption.trim() || null })}
                multiline
                placeholder="Write a caption…"
                placeholderTextColor={Color.meta}
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                accessibilityLabel="Caption"
                style={styles.captionInput}
              />
              <TextInput
                value={tags}
                onChangeText={setTags}
                onBlur={() => save({ hashtags: tags.trim() || null })}
                placeholder="#hashtags"
                placeholderTextColor={Color.meta}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                accessibilityLabel="Hashtags"
                style={styles.tagsInput}
              />
              <View style={styles.chipRow}>
                <Pressable accessibilityRole="button" onPress={aiWrite} disabled={busy !== null} style={styles.chip}>
                  {busy === 'write' ? <ActivityIndicator size="small" color={Color.violet} /> : <Icon name="spark" size={14} color={Color.violet} />}
                  <Text style={styles.chipText}>AI write</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={translate} disabled={busy !== null} style={styles.chip}>
                  {busy === 'translate' && <ActivityIndicator size="small" color={Color.violet} />}
                  <Text style={styles.chipText}>Translate</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.lbl}>POST TO</Text>
          <View style={[styles.card, { gap: 14 }]}>
            {APPS.map((a) => {
              const on = apps.includes(a.key);
              return (
                <Pressable
                  key={a.key}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={a.name}
                  onPress={() => {
                    const next = on ? apps.filter((x) => x !== a.key) : [...apps, a.key];
                    setApps(next);
                    save({ post_apps: next });
                  }}
                  style={styles.appBtn}>
                  <View style={[styles.apt, { backgroundColor: on ? Color.white : Color.control }]}>
                    <View style={{ opacity: on ? 1 : 0.45 }}>
                      <FontAwesome6 name={a.glyph} brand size={22} color={on ? a.onTile : a.offTile} />
                    </View>
                  </View>
                  <Text style={styles.appName}>{a.name}</Text>
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
      </KeyboardAvoidingView>
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
  titleInput: { height: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: Color.control, fontFamily: Font.semibold, fontSize: 15, color: Color.white },
  captionInput: {
    minHeight: 72,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
    backgroundColor: Color.control,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.white,
    textAlignVertical: 'top',
  },
  tagsInput: { height: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, color: Color.violet },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42' },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  appBtn: { alignItems: 'center', gap: 6 },
  apt: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aptMore: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#3A3A42' },
  appName: { fontFamily: Font.medium, fontSize: 14, lineHeight: 18, color: Color.white },
});
