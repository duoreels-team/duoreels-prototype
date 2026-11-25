/**
 * NEW · Notifications: master switch (same as on Me), quiet hours (start / end time),
 * and one switch per kind. Saved to your profile. Turning on asks for permission.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Toggle } from '@/components/brand/bits';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { useSaveProfile } from '@/lib/me';
import type { Profile } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';

const KINDS: [keyof Profile, string, string][] = [
  ['notify_versions', 'New version uploaded', '“Leo uploaded v3”'],
  ['notify_replies', 'Notes replied', 'When your editor answers a note'],
  ['notify_more_time', 'Editor asks for more time', 'So you can accept or decline'],
  ['notify_messages', 'Messages', 'Chats with editors'],
  ['notify_payments', 'Payments', 'Money held, released, refunded'],
];

function toDate(t: string | undefined, fallback: string) {
  const [h, m] = (t ?? fallback).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d;
}
function toTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function label(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

function TimeSheet({ title, value, onDone }: { title: string; value: Date; onDone: (d: Date) => void }) {
  const [v, setV] = useState(value);
  return (
    <View>
      <Text style={styles.t20}>{title}</Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.pickerBox}>
          <DateTimePicker value={v} mode="time" display="spinner" minuteInterval={15} themeVariant="dark" textColor={Color.white} onChange={(_, d) => d && setV(d)} />
        </View>
      ) : (
        <BigButton
          label={label(v)}
          tone="control"
          onPress={() =>
            import('@react-native-community/datetimepicker').then(({ DateTimePickerAndroid }) =>
              DateTimePickerAndroid.open({ value: v, mode: 'time', is24Hour: false, onChange: (e, d) => e.type === 'set' && d && setV(d) }),
            )
          }
        />
      )}
      <BigButton label="Done" onPress={() => onDone(v)} style={{ marginTop: 16 }} />
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const save = useSaveProfile();
  const { openSheet, closeSheet, toast } = useOverlay();
  const on = profile?.notify_on ?? true;
  const start = toDate(profile?.quiet_start, '22:00');
  const end = toDate(profile?.quiet_end, '08:00');

  async function set(fields: Partial<Profile>) {
    const err = await save(fields);
    if (err) toast(err);
  }

  async function master(next: boolean) {
    if (next) {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) toast('Allow notifications in Settings to get them on this phone', undefined, false);
    }
    set({ notify_on: next });
  }

  const pick = (which: 'quiet_start' | 'quiet_end') =>
    openSheet(
      <TimeSheet
        title={which === 'quiet_start' ? 'Quiet from' : 'Quiet until'}
        value={which === 'quiet_start' ? start : end}
        onDone={(d) => {
          closeSheet();
          set({ [which]: toTime(d) } as Partial<Profile>);
        }}
      />,
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Notifications" sub={on ? `Quiet ${label(start)} – ${label(end)}` : 'Off'} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { marginTop: 4 }]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.meta}>New versions, requests and messages</Text>
            </View>
            <Toggle label="Notifications" on={on} onChange={master} />
          </View>
        </View>

        <Text style={styles.sec}>QUIET HOURS</Text>
        <View style={[styles.card, !on && styles.off]}>
          <Pressable accessibilityRole="button" disabled={!on} onPress={() => pick('quiet_start')} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={[styles.rowTitle, styles.flex]}>From</Text>
            <Text style={styles.mono}>{label(start)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!on} onPress={() => pick('quiet_end')} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
            <Text style={[styles.rowTitle, styles.flex]}>Until</Text>
            <Text style={styles.mono}>{label(end)}</Text>
          </Pressable>
        </View>
        <Text style={[styles.meta, { marginTop: 8 }]}>Nothing buzzes in between. You still see it all in Messages.</Text>

        <Text style={styles.sec}>TELL ME ABOUT</Text>
        <View style={[styles.card, !on && styles.off]}>
          {KINDS.map(([k, title, sub], i) => (
            <View key={k} style={[styles.row, i > 0 && styles.rowLine]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.meta}>{sub}</Text>
              </View>
              <Toggle label={title} on={(profile?.[k] as boolean | undefined) ?? true} onChange={(v) => on && set({ [k]: v } as Partial<Profile>)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  off: { opacity: 0.45 },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 4, marginBottom: 12 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  mono: { fontFamily: Font.mono, fontSize: 14, lineHeight: 20, color: Color.white },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  pickerBox: { borderRadius: 12, backgroundColor: Color.control, overflow: 'hidden', alignItems: 'center' },
});
