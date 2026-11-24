/**
 * Plan and storage (prototype V.plan, 55cab08): storage card with your plan,
 * VIP and SVIP cards ("Try … free for 7 days", no payment), your plan outlined
 * in white, "Go back to Free", Download all finals, and how long files are kept.
 */
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Tag } from '@/components/brand/bits';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { downloadVersion } from '@/lib/download';
import { gb, planOf, PLANS, useSaveProfile, useStorage, type PlanKey } from '@/lib/me';
import type { Version } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

/** Trials last 7 days. */
function inSevenDays() {
  return new Date(Date.now() + 7 * 86400000).toISOString();
}

function renewLabel(iso?: string | null) {
  if (!iso) return 'monthly';
  return new Date(iso).toDateString().slice(4, 10);
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { toast } = useOverlay();
  const save = useSaveProfile();
  const storage = useStorage();
  const [saving, setSaving] = useState(false);
  const cur = planOf(profile);
  const P = PLANS[cur];
  const pct = Math.min(100, (storage.total / (P.gb * 1e9)) * 100);

  async function choose(k: PlanKey) {
    const credits = PLANS[k].credits;
    const err = await save({
      plan: k,
      trial_ends_at: k === 'free' ? null : inSevenDays(),
      // AI credits follow the plan (SVIP is unlimited, so the number isn't used).
      ...(credits !== null ? { ai_credits: credits } : {}),
    });
    toast(err ?? (k === 'free' ? 'Back on Free' : `${PLANS[k].tier} trial started · no payment is taken`));
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
        if ((await downloadVersion(finals[i].v, finals[i].p.name, () => {}).done) === 'saved') ok += 1;
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

  const card = (k: Exclude<PlanKey, 'free'>) => {
    const T = PLANS[k];
    const on = cur === k;
    return (
      <View key={k} style={[styles.tiercard, on && styles.tierOn]}>
        <View style={styles.tierHead}>
          <Tag label={T.tier} tone={k === 'svip' ? 'svip' : 'violet'} height={22} />
          <Text style={[styles.rowTitle, { fontSize: 16 }]}>{T.name}</Text>
          <View style={styles.flex} />
          <Text style={styles.price}>
            {T.price}
            <Text style={[styles.meta, { fontFamily: Font.medium }]}> / month</Text>
          </Text>
        </View>
        <Text style={[styles.meta, { marginTop: 8 }]}>
          {T.short}
          {k === 'svip' ? '' : ' · AI write and Tidy up'}
        </Text>
        {on ? (
          <Text style={[styles.meta, { marginTop: 10, color: Color.white }]}>Your plan · renews {renewLabel(profile?.trial_ends_at)}</Text>
        ) : (
          <BigButton label={`Try ${T.tier} free for 7 days`} tone={k === 'vip' ? 'violet' : 'control'} onPress={() => choose(k)} style={{ marginTop: 12 }} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Plan and storage" sub={`${P.name} plan · ${gb(storage.total)} of ${P.gbLabel} used`} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { padding: 16, marginTop: 4 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowTitle}>{P.name} plan</Text>
            {P.tier ? <Tag label={P.tier} tone={cur === 'svip' ? 'svip' : 'violet'} height={22} /> : null}
            <View style={styles.flex} />
            <Text style={styles.meta}>
              {gb(storage.total)} of {P.gbLabel}
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(pct, storage.total ? 1 : 0)}%` }]} />
          </View>
          <Text style={styles.meta}>
            Raw footage {gb(storage.footage)} · notes and voice {gb(storage.notes)} · versions and covers {gb(Math.max(0, storage.other))}
          </Text>
        </View>

        <Text style={styles.sec}>PLANS</Text>
        <View style={{ gap: 12 }}>
          {card('vip')}
          {card('svip')}
        </View>
        {cur !== 'free' && (
          <Pressable accessibilityRole="button" onPress={() => choose('free')} hitSlop={8} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <Text style={[styles.rowTitle, { fontSize: 14, color: Color.meta }]}>Go back to Free</Text>
          </Pressable>
        )}

        <BigButton label={saving ? 'Saving finals…' : 'Download all finals'} tone="control" loading={saving} onPress={downloadAll} style={{ marginTop: 18 }} />
        <Text style={styles.small}>
          Raw footage and old versions are kept 30 days after a project is done. Finals are kept 60 days on Free, 1 year on VIP and SVIP. We remind you 7 days and 1 day before anything is removed.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  small: { fontFamily: Font.regular, fontSize: 13, lineHeight: 20, color: Color.meta, marginTop: 16 },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  bar: { height: 4, borderRadius: 4, backgroundColor: Color.control, overflow: 'hidden', marginTop: 12, marginBottom: 8 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: Color.violet },
  tiercard: { padding: 16, borderRadius: 14, backgroundColor: Color.surface, borderWidth: 1.5, borderColor: Color.control },
  tierOn: { borderColor: Color.white },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontFamily: Font.display, fontSize: 26, lineHeight: 30, paddingTop: 2, color: Color.white },
});
