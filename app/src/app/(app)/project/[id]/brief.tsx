/**
 * Brief and references (prototype V.brief): the brief, feel chips, must have · avoid,
 * the references from New project, Save brief.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { editorName } from '@/lib/projects';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { useSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

const SAMPLE_BRIEF = 'Reels, 30–45 s. Fast cuts, white one-line subtitles, no trending sounds. Start on the coffee.';
const FEEL: [string, boolean][] = [
  ['Calm', true],
  ['Warm', true],
  ['Bright', false],
  ['Funny', false],
  ['Cinematic', false],
];
const MUST: [string, boolean][] = [
  ['Logo in the last 2 seconds', true],
  ['Captions on', true],
  ['Fast cuts', false],
  ['Loud music', false],
];

type Ref = { id: string; title: string | null; file_path: string | null; mime_type: string | null };

function RefTile({ r }: { r: Ref }) {
  const url = useSignedUrl(r.mime_type?.startsWith('image/') ? r.file_path : null);
  return (
    <View>
      <View style={styles.reel}>{url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.reelIcon}><Icon name="video" size={22} color={Color.text2} /></View>}</View>
      <Text style={[styles.lab, { marginTop: 6 }]} numberOfLines={1}>
        {r.title ?? 'Reference'}
      </Text>
    </View>
  );
}

export default function BriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const { update } = useProjects();
  const { toast } = useOverlay();
  const [brief, setBrief] = useState(p?.brief ?? (p?.is_sample ? SAMPLE_BRIEF : ''));
  const [feel, setFeel] = useState(FEEL.filter(([, on]) => on).map(([t]) => t));
  const [refs, setRefs] = useState<Ref[]>([]);

  useEffect(() => {
    supabase
      .from('footage')
      .select('id, title, file_path, mime_type')
      .eq('project_id', id)
      .eq('kind', 'reference')
      .order('created_at')
      .then(({ data }) => setRefs((data as Ref[]) ?? []));
  }, [id]);

  if (!p) return null;
  const ed = editorName(p);
  const count = p.is_sample ? 2 : refs.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Brief and references" sub={`${p.name} · ${ed} sees this`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lbl, { marginTop: 6 }]}>THE BRIEF</Text>
          <TextInput value={brief} onChangeText={setBrief} multiline style={styles.field} selectionColor={Color.violet} keyboardAppearance="dark" placeholder="What should it feel like? Length, pace, music, captions…" placeholderTextColor={Color.meta} accessibilityLabel="The brief" />

          <Text style={styles.lbl}>FEEL</Text>
          <View style={styles.chips}>
            {FEEL.map(([t]) => {
              const on = feel.includes(t);
              return (
                <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFeel((f) => (on ? f.filter((x) => x !== t) : [...f, t]))} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: Color.black }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.lbl}>MUST HAVE · AVOID</Text>
          <View style={styles.card}>
            {MUST.map(([t, on]) => (
              <View key={t} style={styles.mustRow}>
                <Icon name={on ? 'check' : 'close'} size={16} strokeWidth={2.2} color={on ? Color.green : Color.meta} />
                <Text style={[styles.t15, !on && { color: Color.meta }]}>{t}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.lbl}>REFERENCES · {count}</Text>
          <View style={styles.refs}>
            {p.is_sample
              ? (
                  [
                    ['mk1', '1:26', '@sunrisesam', 'pacing'],
                    ['mk6', '2:04', '@calmcoffee', 'colour'],
                  ] as const
                ).map(([k, d, h, what]) => (
                  <View key={k}>
                    <View style={styles.reel}>
                      <Image source={SAMPLE_IMAGES[k]} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <View style={styles.dur}>
                        <Text style={styles.durText}>{d}</Text>
                      </View>
                    </View>
                    <Text style={[styles.lab, { marginTop: 6 }]}>{h}</Text>
                    <Text style={styles.meta}>{what}</Text>
                  </View>
                ))
              : refs.map((r) => <RefTile key={r.id} r={r} />)}
            {!p.is_sample && !refs.length && <Text style={styles.meta}>No references yet.</Text>}
          </View>

          <View style={{ marginTop: 22 }}>
            <BigButton
              label="Save brief"
              onPress={async () => {
                const err = await update(id, { brief: brief.trim() || null });
                if (err) {
                  toast(err);
                  return;
                }
                toast(`Brief saved · ${ed} sees a NEW tag`);
                router.back();
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white, maxWidth: 96 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white },
  field: { minHeight: 110, borderRadius: 8, padding: 14, backgroundColor: Color.surface, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42', justifyContent: 'center' },
  chipOn: { backgroundColor: Color.white, borderColor: Color.white },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  card: { borderRadius: 12, backgroundColor: Color.surface, paddingVertical: 6, paddingHorizontal: 14 },
  mustRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9 },
  refs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reel: { width: 96, aspectRatio: 9 / 13, borderRadius: 8, overflow: 'hidden', backgroundColor: Color.surface },
  reelIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dur: { position: 'absolute', left: 4, bottom: 4, height: 20, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.white },
});
