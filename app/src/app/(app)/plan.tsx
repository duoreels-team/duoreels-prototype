/**
 * Plans (prototype V.plan, 508576e): your plan + storage, "Choose a plan" (Free, VIP,
 * SVIP — tap one for what you get and the 7-day trial), the Compare table, and on a
 * paid plan "Your subscription" (cancel, refund help). Nothing is ever charged here:
 * starting a trial only saves the plan and its trial end date on your profile.
 */
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { downloadVersion } from '@/lib/download';
import { gb, PLAN_COMPARE, PLAN_LIST, planOf, PLANS, tierTone, useSaveProfile, useStorage, type PlanKey } from '@/lib/me';
import type { Version } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

const KEYS: PlanKey[] = ['free', 'vip', 'svip'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Trials last 7 days. */
function inSevenDays() {
  return new Date(Date.now() + 7 * 86400000).toISOString();
}

/** "Dec 24": when the trial (or the paid month) ends. */
function untilLabel(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 30 * 86400000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/* ---------- sheets ---------- */

function PlanInfoSheet({ k, cur, onChoose }: { k: PlanKey; cur: PlanKey; onChoose: (k: PlanKey) => void }) {
  const P = PLANS[k];
  return (
    <View>
      <View style={styles.infoHead}>
        <Tag label={P.tier} tone={tierTone(k)} height={22} />
        <Text style={styles.t20}>{P.name}</Text>
      </View>
      <Text style={styles.bigPrice}>
        {P.price}
        {k !== 'free' && <Text style={[styles.meta, { fontSize: 15 }]}> / month</Text>}
      </Text>
      <View style={[styles.list, { marginTop: 14 }]}>
        {PLAN_LIST[k].map((x, i) => (
          <View key={x} style={[styles.checkRow, i > 0 && styles.rowLine]}>
            <Icon name="check" size={16} strokeWidth={2.4} />
            <Text style={[styles.t15, styles.flex]}>{x}</Text>
          </View>
        ))}
      </View>
      {cur === k ? (
        <Text style={[styles.meta, { marginTop: 14 }]}>This is your plan.</Text>
      ) : k === 'free' ? (
        <BigButton label="Switch to Free" tone="control" onPress={() => onChoose('free')} style={{ marginTop: 16 }} />
      ) : (
        <>
          <Text style={[styles.small, { marginTop: 14 }]}>
            7 days free, then {P.price} a month through the App Store. Cancel any time before the trial ends and you won&apos;t be charged.
          </Text>
          <BigButton label="Start 7-day free trial" onPress={() => onChoose(k)} style={{ marginTop: 14 }} />
        </>
      )}
    </View>
  );
}

function CancelSheet({ k, until, onKeep, onCancel }: { k: PlanKey; until: string; onKeep: () => void; onCancel: () => void }) {
  const P = PLANS[k];
  return (
    <View>
      <Text style={[styles.t20, { marginTop: 6, marginBottom: 8 }]}>Cancel {P.tier}?</Text>
      <Text style={[styles.t15, { color: Color.text2 }]}>
        You keep {P.name} until {until}, then move to Free. Your projects and files stay.
      </Text>
      <View style={styles.pair}>
        <BigButton label={`Keep ${P.tier}`} tone="control" onPress={onKeep} style={styles.flex} />
        <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.whiteBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.whiteText}>Cancel plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RefundSheet({ onDone }: { onDone: () => void }) {
  const steps: [string, string, string][] = [
    ['1', 'Open reportaproblem.apple.com', 'or the Purchases page in your Apple account'],
    ['2', 'Find Duoreels', 'pick the charge you want back'],
    ['3', 'Choose “Request a refund”', 'Apple tells you by email'],
  ];
  return (
    <View>
      <Text style={[styles.t20, { marginTop: 6, marginBottom: 8 }]}>Refunds</Text>
      <Text style={[styles.t15, { color: Color.text2, marginBottom: 12 }]}>Plans are paid through the App Store, so Apple handles refunds, not us.</Text>
      <View style={styles.list}>
        {steps.map(([n, a, b], i) => (
          <Pressable
            key={n}
            accessibilityRole={i === 0 ? 'link' : undefined}
            disabled={i !== 0}
            onPress={() => WebBrowser.openBrowserAsync('https://reportaproblem.apple.com')}
            style={({ pressed }) => [styles.stepRow, i > 0 && styles.rowLine, pressed && { backgroundColor: '#26262A' }]}>
            <Text style={styles.stepNum}>{n}</Text>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, i === 0 && { color: Color.violet }]}>{a}</Text>
              <Text style={styles.meta}>{b}</Text>
            </View>
            {i === 0 && <Icon name="link" size={18} color={Color.violet} />}
          </Pressable>
        ))}
      </View>
      <Text style={[styles.small, { marginTop: 12 }]}>Just want to stop paying? Cancel in Plans. You keep the plan until the end of the month you paid for.</Text>
      <BigButton label="Got it" tone="control" onPress={onDone} style={{ marginTop: 14 }} />
    </View>
  );
}

/* ---------- the page ---------- */

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { toast, openSheet, closeSheet } = useOverlay();
  const save = useSaveProfile();
  const storage = useStorage();
  const [saving, setSaving] = useState(false);
  const cur = planOf(profile);
  const P = PLANS[cur];
  const pct = Math.min(100, (storage.total / (P.gb * 1e9)) * 100);
  const until = untilLabel(profile?.trial_ends_at);

  async function choose(k: PlanKey) {
    closeSheet();
    const credits = PLANS[k].credits;
    const err = await save({
      plan: k,
      trial_ends_at: k === 'free' ? null : inSevenDays(),
      // AI credits follow the plan (SVIP is unlimited, so the number isn't used).
      ...(credits !== null ? { ai_credits: credits } : {}),
    });
    toast(err ?? (k === 'free' ? 'Back on Free' : `${PLANS[k].tier} trial started · no payment is taken`));
  }

  const info = (k: PlanKey) => openSheet(<PlanInfoSheet k={k} cur={cur} onChoose={choose} />);
  const refund = () => openSheet(<RefundSheet onDone={closeSheet} />);

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

  const col = { free: 1, vip: 2, svip: 3 }[cur];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Plans" sub={`You are on ${P.name}`} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { padding: 16, marginTop: 4 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowTitle}>{P.name} plan</Text>
            <Tag label={P.tier} tone={tierTone(cur)} height={22} />
            <View style={styles.flex} />
            <Text style={styles.meta}>
              {storage.loading ? '…' : gb(storage.total)} of {P.gbLabel}
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(pct, storage.total ? 1 : 0)}%` }]} />
          </View>
          <Text style={styles.meta}>{P.short}</Text>
        </View>

        <Text style={styles.sec}>CHOOSE A PLAN</Text>
        <View style={{ gap: 12 }}>
          {KEYS.map((k) => {
            const T = PLANS[k];
            const on = cur === k;
            return (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${T.name} plan`} onPress={() => info(k)} style={({ pressed }) => [styles.tiercard, on && styles.tierOn, pressed && { opacity: 0.85 }]}>
                <View style={styles.tierHead}>
                  <Tag label={T.tier} tone={tierTone(k)} height={22} />
                  <Text style={[styles.rowTitle, { fontSize: 16 }]}>{T.name}</Text>
                  <View style={styles.flex} />
                  <Text style={styles.price}>
                    {T.price}
                    {k !== 'free' && <Text style={[styles.meta, { fontFamily: Font.medium }]}> / mo</Text>}
                  </Text>
                </View>
                <Text style={[styles.meta, { marginTop: 8 }]}>{T.short}</Text>
                <Text style={[styles.meta, { marginTop: 8, color: on ? Color.white : Color.violet }]}>{on ? 'Your plan' : 'See what you get ›'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sec}>COMPARE</Text>
        <View style={styles.ptable}>
          <View style={[styles.pr, styles.ph]}>
            <View style={styles.pcLabel} />
            {KEYS.map((k) => (
              <View key={k} style={styles.pc}>
                <Tag label={PLANS[k].tier} tone={tierTone(k)} height={20} />
              </View>
            ))}
          </View>
          {PLAN_COMPARE.map((f) => (
            <View key={f[0]} style={[styles.pr, styles.rowLine]}>
              <Text style={[styles.meta, styles.pcLabel]}>{f[0]}</Text>
              {[1, 2, 3].map((c) => (
                <Text key={c} style={[styles.pcText, styles.pc, col === c && styles.pcCur]}>
                  {f[c]}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {cur !== 'free' ? (
          <>
            <Text style={styles.sec}>YOUR SUBSCRIPTION</Text>
            <View style={styles.list}>
              <Pressable accessibilityRole="button" onPress={() => openSheet(<CancelSheet k={cur} until={until} onKeep={closeSheet} onCancel={() => choose('free')} />)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#26262A' }]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>Cancel {P.tier}</Text>
                  <Text style={styles.meta}>
                    You keep {P.tier} until {until}, then move to Free
                  </Text>
                </View>
                <Icon name="chev" size={18} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={refund} style={({ pressed }) => [styles.row, styles.rowLine, pressed && { backgroundColor: '#26262A' }]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>Request a refund</Text>
                  <Text style={styles.meta}>Refunds go through the App Store</Text>
                </View>
                <Icon name="chev" size={18} />
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={refund} hitSlop={8} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <Text style={[styles.rowTitle, { fontSize: 14, color: Color.meta }]}>How do refunds work?</Text>
          </Pressable>
        )}

        <BigButton label={saving ? 'Saving finals…' : 'Download all finals'} tone="control" loading={saving} onPress={downloadAll} style={{ marginTop: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  list: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 21, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  small: { fontFamily: Font.regular, fontSize: 13, lineHeight: 19, color: Color.meta },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  bar: { height: 4, borderRadius: 4, backgroundColor: Color.control, overflow: 'hidden', marginTop: 12, marginBottom: 8 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: Color.violet },
  tiercard: { padding: 16, borderRadius: 14, backgroundColor: Color.surface, borderWidth: 1.5, borderColor: Color.control },
  tierOn: { borderColor: Color.white },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontFamily: Font.display, fontSize: 24, lineHeight: 28, paddingTop: 2, color: Color.white },
  bigPrice: { fontFamily: Font.display, fontSize: 32, lineHeight: 36, paddingTop: 2, color: Color.white },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 14 },
  ptable: { backgroundColor: Color.surface, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingVertical: 6 },
  ph: { minHeight: 40 },
  pcLabel: { flex: 1.5 },
  pc: { flex: 1, alignItems: 'center', textAlign: 'center' },
  pcText: { fontFamily: Font.medium, fontSize: 14, lineHeight: 18, color: '#B8B8C0' },
  pcCur: { fontFamily: Font.bold, color: Color.white },
  pair: { flexDirection: 'row', gap: 10, marginTop: 18 },
  whiteBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: Color.white, alignItems: 'center', justifyContent: 'center' },
  whiteText: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.black },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  stepNum: { width: 22, fontFamily: Font.mono, fontSize: 13, lineHeight: 18, color: Color.violet },
});
