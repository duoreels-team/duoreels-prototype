/**
 * Me (prototype V.me, 55cab08): photo with camera badge (tap = change photo straight
 * away), name, role · city; the plan card FIRST; then Finance, Storage (storage bar +
 * AI credits), Settings, Sign out.
 */
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, Tag, Toggle } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font, Space } from '@/constants/brand';
import { useMarket } from '@/lib/market';
import { creditsLine, gb, moneySummary, planOf, PLANS, tierTone, useSaveProfile, useStorage, usd } from '@/lib/me';
import { changeMyPhoto } from '@/lib/my-photo';
import { editorFull } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';
import { useViewRole } from '@/providers/view-role';

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
  const { profile, session, signOut, reloadProfile } = useAuth();
  const { projects } = useProjects();
  const { role, setRole } = useViewRole();
  const { toast } = useOverlay();
  const market = useMarket();
  const save = useSaveProfile();
  const storage = useStorage();
  const [perm, requestPerm] = ImagePicker.useMediaLibraryPermissions();
  const [templates, setTemplates] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('brief_templates')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setTemplates(count ?? 0));
  }, []);

  const m = moneySummary(projects);
  const plan = planOf(profile);
  const P = PLANS[plan];
  const pct = Math.min(100, (storage.total / (P.gb * 1e9)) * 100);
  const editorView = role === 'editor';

  function onPhoto() {
    if (!session) return;
    // Ask for Photos only once (the very first time); after that the library opens at once.
    if (perm && perm.status === 'undetermined' && perm.canAskAgain) {
      requestPerm().then((r) => {
        if (r.granted) changeMyPhoto(session.user.id, reloadProfile, (msg) => toast(msg));
      });
      return;
    }
    changeMyPhoto(session.user.id, async () => {
      await reloadProfile();
      toast('Photo updated');
    }, (msg) => toast(msg));
  }

  async function toggleNotify(on: boolean) {
    if (on) {
      const p = await Notifications.requestPermissionsAsync();
      if (!p.granted) toast('Allow notifications in Settings to get them on this phone', undefined, false);
    }
    const err = await save({ notify_on: on });
    if (err) toast(err);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingTop: insets.top + 20, paddingBottom: 110 }]}>
        <Animated.View entering={slide} style={styles.head}>
          {editorView ? (
            <Avatar k="L" size={64} />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={onPhoto} hitSlop={6} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Avatar k="M" size={64} />
              <View style={styles.cam}>
                <Icon name="camera" size={14} />
              </View>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" disabled={editorView} onPress={() => router.push('/profile-edit')} style={({ pressed }) => [styles.flex, pressed && { opacity: 0.6 }]}>
            <Text style={styles.t28} numberOfLines={1}>
              {editorView ? editorFull('L') : profile?.name || 'You'}
            </Text>
            <Text style={styles.meta}>
              {editorView ? 'Editor' : 'Creator'}
              {!editorView && profile?.city ? ` · ${profile.city}` : ''}
            </Text>
          </Pressable>
        </Animated.View>

        {/* plan card first (.plancard) */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={({ pressed }) => [styles.plancard, plan !== 'free' && styles.plancardPaid, pressed && { opacity: 0.85 }]}>
          <LinearGradient
            colors={plan === 'free' ? [Color.surface, '#1A1430'] : ['#3A2590', '#221650', '#141218']}
            start={plan === 'free' ? { x: 0, y: 0.3 } : { x: 0.9, y: 0.1 }}
            end={plan === 'free' ? { x: 1, y: 0.7 } : { x: 0.1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.flex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.rowTitle, { fontSize: 16 }]}>{P.name} plan</Text>
              <Tag label={P.tier} tone={tierTone(plan)} height={22} />
            </View>
            <Text style={styles.meta}>{P.short}</Text>
          </View>
          {plan === 'free' ? (
            <View style={styles.upg}>
              <Text style={styles.upgText}>UPGRADE</Text>
            </View>
          ) : (
            <Icon name="chev" size={18} />
          )}
        </Pressable>

        <Text style={styles.sec}>FINANCE</Text>
        <View style={styles.card}>
          <Row first title="Payments and earnings" sub={`${usd(m.paidTotal)} paid · ${usd(m.waitingAmount)} on approval`} onPress={() => router.push('/payments')} />
        </View>

        <Text style={styles.sec}>STORAGE</Text>
        <View style={{ gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={({ pressed }) => [styles.card, styles.storage, pressed && styles.rowPressed]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.rowTitle}>Storage</Text>
              <Text style={styles.meta}>{storage.loading ? '…' : `${gb(storage.total)} of ${P.gbLabel}`}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.max(pct, storage.total ? 1 : 0)}%` }]} />
            </View>
          </Pressable>
          <View style={styles.card}>
            <Row first icon="spark" iconColor={Color.violet} title="AI credits" sub={creditsLine(plan, profile?.ai_credits)} onPress={() => router.push('/credits')} />
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
  cam: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: Color.control, borderWidth: 2, borderColor: Color.black, alignItems: 'center', justifyContent: 'center' },
  t28: { fontFamily: Font.bold, fontSize: 28, lineHeight: 32, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  plancard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Color.control, overflow: 'hidden' },
  plancardPaid: { borderColor: '#3B2A78' },
  upg: { height: 36, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Color.white, justifyContent: 'center' },
  upgText: { fontFamily: Font.display, fontSize: 17, lineHeight: 21, paddingTop: 2, letterSpacing: 0.5, color: Color.white },
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
