/**
 * Plan and storage (prototype V.plan) with your real storage, plan and finals.
 * "Try Studio free for 7 days" → NEW confirm sheet → Studio trial (no payment).
 * "Download all finals" saves every approved video to Photos.
 */
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { BigButton } from '@/components/brand/bits';
import { CrownMark, Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { downloadVersion } from '@/lib/download';
import { gb, PLAN_GB, useSaveProfile, useStorage } from '@/lib/me';
import type { Version } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

const KEEP: [string, string][] = [
  ['Raw footage', '30 days after the project is done'],
  ['Old versions (v1, v2…)', '30 days after approval'],
  ['Final video', '1 year on Creator · 60 days on Free'],
  ['Reminders', '7 days and 1 day before anything is removed'],
];

function StudioTrialSheet({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  return (
    <View>
      <Text style={styles.t20}>Try Studio free for 7 days</Text>
      <View style={styles.listCard}>
        {[
          ['1 TB of storage', 'Ten times your Creator space'],
          ['3 seats', 'Bring a producer or a second editor'],
          ['AI 4K included', 'No credits needed for upscaling'],
        ].map(([a, b], i) => (
          <View key={a} style={[styles.row, i > 0 && styles.rowLine]}>
            <Icon name="check" size={18} color={Color.green} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{a}</Text>
              <Text style={styles.meta}>{b}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.meta, { marginTop: 12 }]}>$19.99 a month after 7 days. Cancel any time before then. Prototype only · no payment is taken.</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <BigButton label="Start trial" onPress={onStart} style={styles.flex} />
        <BigButton label="Not now" tone="control" onPress={onClose} style={styles.flex} />
      </View>
    </View>
  );
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();
  const save = useSaveProfile();
  const storage = useStorage();
  const [saving, setSaving] = useState(false);
  const plan = profile?.plan ?? 'creator';
  const cap = PLAN_GB[plan];
  const pct = Math.min(100, (storage.total / (cap * 1e9)) * 100);
  const onTrial = plan === 'studio_trial';
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at).toDateString().slice(4, 10) : '';

  async function startTrial() {
    closeSheet();
    const ends = new Date(Date.now() + 7 * 86400000).toISOString();
    const err = await save({ plan: 'studio_trial', trial_ends_at: ends });
    toast(err ?? 'Studio trial started · free for 7 days');
  }

  async function downloadAll() {
    const done = projects.filter((p) => p.status === 'done' && p.current_version > 0);
    if (!done.length) {
      toast('No finals yet · approve a project first', undefined, false);
      return;
    }
    setSaving(true);
    const { data } = await supabase
      .from('versions')
      .select('id, project_id, number, video_path, thumb_path, media_kind, duration_seconds, by_key, created_at')
      .in('project_id', done.map((p) => p.id));
    const finals = done
      .map((p) => ({ p, v: ((data as Version[]) ?? []).filter((v) => v.project_id === p.id).sort((a, b) => b.number - a.number)[0] }))
      .filter((x) => x.v);
    let ok = 0;
    for (let i = 0; i < finals.length; i++) {
      toast(`Saving ${i + 1} of ${finals.length} · ${finals[i].p.name}`, undefined, false);
      try {
        const r = await downloadVersion(finals[i].v, finals[i].p.name, () => {}).done;
        if (r === 'saved') ok += 1;
      } catch (e) {
        if ((e as Error).message === 'permission') {
          toast('Allow Photos in Settings to save videos', undefined, false);
          setSaving(false);
          return;
        }
      }
    }
    setSaving(false);
    toast(`Saved ${ok} final${ok === 1 ? '' : 's'} to Photos`);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Plan and storage" sub={`${gb(storage.total)} of ${cap} GB used`} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { padding: 16, marginTop: 4 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.rowTitle}>Storage</Text>
            <Text style={styles.meta}>
              {gb(storage.total)} of {cap} GB
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(pct, storage.total ? 1 : 0)}%` }]} />
          </View>
          <Text style={styles.meta}>
            Raw footage {gb(storage.footage)} · notes and voice {gb(storage.notes)} · covers and other {gb(Math.max(0, storage.other))}
          </Text>
        </View>

        <Text style={styles.sec}>HOW LONG WE KEEP FILES</Text>
        <View style={styles.card}>
          {KEEP.map(([a, b], i) => (
            <View key={a} style={[styles.row, i > 0 && styles.rowLine]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{a}</Text>
                <Text style={styles.meta}>{b}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sec}>PLANS</Text>
        <View style={styles.planhero}>
          <LinearGradient colors={['#4A2FA8', '#2A1A5E', '#16121F']} locations={[0, 0.38, 0.75]} start={{ x: 0.85, y: 0.1 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.crownBig}>
            <CrownMark width={120} />
          </View>
          <Text style={[styles.meta, { color: '#CBBCFF' }]}>Member · your plan</Text>
          <Text style={styles.planName}>{onTrial ? 'STUDIO TRIAL' : 'CREATOR'}</Text>
          <Text style={styles.meta}>{onTrial ? `Free until ${trialEnd} · then $19.99 a month` : '$7.99 a month · renews Dec 4'}</Text>
          <Text style={[styles.meta, { color: '#DDDDDD' }]}>{onTrial ? '1 TB · 3 seats · AI 4K included' : '100 GB · unlimited projects · finals kept 1 year'}</Text>
        </View>

        {!onTrial && (
          <>
            <Text style={styles.sec}>UPGRADE</Text>
            <View style={[styles.pricecard]}>
              <Text style={styles.meta}>Studio</Text>
              <Text style={styles.price}>
                $19.99<Text style={[styles.meta, { fontFamily: Font.medium }]}> / month</Text>
              </Text>
              <Text style={styles.meta}>1 TB · 3 seats · AI 4K included</Text>
            </View>
            <View style={{ marginTop: 14 }}>
              <BigButton label="Try Studio free for 7 days" onPress={() => openSheet(<StudioTrialSheet onStart={startTrial} onClose={closeSheet} />)} />
            </View>
          </>
        )}
        <BigButton label={saving ? 'Saving finals…' : 'Download all finals'} tone="control" loading={saving} onPress={downloadAll} style={{ marginTop: 10 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  listCard: { borderRadius: 12, backgroundColor: Color.control, overflow: 'hidden' },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 4, marginBottom: 12 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  bar: { height: 4, borderRadius: 4, backgroundColor: Color.control, overflow: 'hidden', marginTop: 12, marginBottom: 8 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: Color.violet },
  planhero: { minHeight: 150, borderRadius: 14, overflow: 'hidden', paddingVertical: 18, paddingHorizontal: 16, justifyContent: 'flex-end', gap: 2, borderWidth: 1, borderColor: '#3B2A78' },
  crownBig: { position: 'absolute', right: 12, top: 14, shadowColor: Color.violet, shadowOpacity: 0.65, shadowRadius: 11, shadowOffset: { width: 0, height: 6 } },
  planName: { fontFamily: Font.display, fontSize: 30, lineHeight: 34, paddingTop: 2, color: Color.white },
  pricecard: { padding: 14, borderRadius: 12, backgroundColor: Color.surface, borderWidth: 1.5, borderColor: '#3A3A42' },
  price: { fontFamily: Font.display, fontSize: 30, lineHeight: 34, paddingTop: 2, color: Color.white, marginVertical: 2 },
});
