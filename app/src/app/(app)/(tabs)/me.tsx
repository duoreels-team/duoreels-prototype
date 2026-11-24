/**
 * Me (prototype V.me): avatar, name, role · city, Finance, Plans and storage,
 * Settings, Switch view, Sign out. NEW: tap the avatar/name to edit your profile,
 * and a Saved editors row.
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, Toggle } from '@/components/brand/bits';
import { CrownMark, Icon, type IconName } from '@/components/brand/icons';
import { Color, Font, Space } from '@/constants/brand';
import { useMarket } from '@/lib/market';
import { gb, moneySummary, PLAN_GB, useSaveProfile, useStorage, usd } from '@/lib/me';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';
import { useViewRole } from '@/providers/view-role';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';

const slide = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(550);

export function quietLabel(start?: string, end?: string) {
  const f = (t?: string) => {
    const [h, m] = (t ?? '00:00').split(':').map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
  };
  return `Quiet ${f(start ?? '22:00')} – ${f(end ?? '08:00')}`;
}

export const PLAN_NAME: Record<string, string> = { free: 'Free plan', creator: 'Creator plan', studio_trial: 'Studio trial', studio: 'Studio plan' };

function Row({ icon, iconColor, title, sub, onPress, right, first }: { icon?: IconName; iconColor?: string; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; first?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      {icon && <Icon name={icon} size={20} color={iconColor ?? Color.white} />}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.meta}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chev" size={18} /> : null)}
    </Pressable>
  );
}

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { projects } = useProjects();
  const { role, setRole } = useViewRole();
  const { toast } = useOverlay();
  const market = useMarket();
  const save = useSaveProfile();
  const storage = useStorage();
  const [templates, setTemplates] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('brief_templates')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setTemplates(count ?? 0));
  }, []);

  const m = moneySummary(projects);
  const plan = profile?.plan ?? 'creator';
  const cap = PLAN_GB[plan] * 1e9;
  const pct = Math.min(100, (storage.total / cap) * 100);
  const editorView = role === 'editor';

  async function toggleNotify(on: boolean) {
    if (on) {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) toast('Allow notifications in Settings to get them on this phone', undefined, false);
    }
    const err = await save({ notify_on: on });
    if (err) toast(err);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingTop: insets.top + 20, paddingBottom: 110 }]}>
        <Animated.View entering={slide}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/profile-edit')} style={styles.head}>
            <Avatar k="M" size={64} />
            <View style={styles.flex}>
              <Text style={styles.t28} numberOfLines={1}>
                {profile?.name || 'You'}
              </Text>
              <Text style={styles.meta}>
                {editorView ? 'Editor' : 'Creator'}
                {profile?.city ? ` · ${profile.city}` : ''}
              </Text>
            </View>
            <Icon name="pen" size={18} color={Color.meta} />
          </Pressable>
        </Animated.View>

        <Text style={styles.sec}>FINANCE</Text>
        <View style={styles.card}>
          <Row first title="Payments and earnings" sub={`${usd(m.paidTotal)} paid · ${usd(m.waitingAmount)} on approval`} onPress={() => router.push('/payments')} />
        </View>

        <Text style={styles.sec}>PLANS AND STORAGE</Text>
        <View style={{ gap: 10 }}>
          <View style={styles.card}>
            <Row
              first
              title={PLAN_NAME[plan]}
              sub={plan === 'studio_trial' && profile?.trial_ends_at ? `Studio free until ${new Date(profile.trial_ends_at).toDateString().slice(4, 10)}` : `Unlimited projects · ${PLAN_GB[plan]} GB`}
              onPress={() => router.push('/plan')}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CrownMark width={22} />
                  <Icon name="chev" size={18} />
                </View>
              }
            />
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={({ pressed }) => [styles.card, styles.storage, pressed && styles.rowPressed]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.rowTitle}>Storage</Text>
              <Text style={styles.meta}>{storage.loading ? '…' : `${gb(storage.total)} of ${PLAN_GB[plan]} GB`}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.max(pct, storage.total ? 1 : 0)}%` }]} />
            </View>
          </Pressable>
          <View style={styles.card}>
            <Row first icon="spark" iconColor={Color.violet} title="AI credits" sub={`${profile?.ai_credits ?? 12} left · Tidy up, AI write, AI 4K`} onPress={() => router.push('/credits')} />
          </View>
        </View>

        <Text style={styles.sec}>SETTINGS</Text>
        <View style={styles.card}>
          <Row first title="Brief templates" sub={templates === null ? '…' : `${templates} saved`} onPress={() => router.push('/templates')} />
          <Row title="Notifications" sub={quietLabel(profile?.quiet_start, profile?.quiet_end)} onPress={() => router.push('/notifications')} right={<Toggle label="Notifications" on={profile?.notify_on ?? true} onChange={toggleNotify} />} />
          <Row icon="heart" iconColor={Color.violet} title="Saved editors" sub={`${market.saved.length} saved`} onPress={() => router.push('/saved')} />
          <Row
            icon="swap"
            iconColor={Color.blue}
            title={`Switch to ${editorView ? 'creator' : 'editor'} view`}
            sub="Same app, the other side's wording"
            onPress={() => {
              setRole(editorView ? 'creator' : 'editor');
              router.navigate('/');
              toast(`Now in ${editorView ? 'creator' : 'editor'} view`, undefined, false);
            }}
          />
        </View>

        <BigButton label="Sign out" tone="control" onPress={signOut} style={{ marginTop: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  t28: { fontFamily: Font.bold, fontSize: 28, lineHeight: 32, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  storage: { padding: 14 },
  bar: { height: 4, borderRadius: 4, backgroundColor: Color.control, overflow: 'hidden', marginTop: 10 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: Color.violet },
});
