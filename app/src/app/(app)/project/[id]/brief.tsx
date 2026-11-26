/**
 * Brief and references (prototype V.brief): the brief, feel chips, must have · avoid,
 * the references from New project, Save brief.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip } from '@/components/brand/bits';
import { ReferencesSection } from '@/components/project/files';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { editorName } from '@/lib/projects';
import { useProjectFiles } from '@/lib/project-files';
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

export default function BriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const { update } = useProjects();
  const { toast } = useOverlay();
  const [brief, setBrief] = useState(p?.brief ?? (p?.is_sample ? SAMPLE_BRIEF : ''));
  const [feel, setFeel] = useState(FEEL.filter(([, on]) => on).map(([t]) => t));
  const files = useProjectFiles(id);
  const refCount = files.rows.filter((r) => r.kind === 'reference').length;

  if (!p) return null;
  const ed = editorName(p);
  const count = p.is_sample && !refCount ? 2 : refCount;

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
                <Chip key={t} label={t} on={on} onPress={() => setFeel((f) => (on ? f.filter((x) => x !== t) : [...f, t]))} />
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
          <ReferencesSection projectId={id} />

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
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white },
  field: { minHeight: 110, borderRadius: 8, padding: 14, backgroundColor: Color.surface, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: 12, backgroundColor: Color.surface, paddingVertical: 6, paddingHorizontal: 14 },
  mustRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9 },
});
