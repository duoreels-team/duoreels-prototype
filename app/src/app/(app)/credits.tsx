/**
 * NEW · AI credits: credits left, what each AI action costs, recent use,
 * and "Get more credits" (no-charge demo sheet).
 */
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { AI_COST, AI_LABEL, useSaveProfile } from '@/lib/me';
import { inboxTime } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

type Use = { id: string; action: string; credits: number; project_id: string | null; created_at: string };

const WHAT: [keyof typeof AI_COST, string][] = [
  ['tidy', 'Shortens your notes, same meaning'],
  ['ai_write', 'Writes a caption and hashtags on Post'],
  ['translate', 'Translates your caption'],
  ['ai_4k', 'Upscales a final to 4K'],
];

export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();
  const save = useSaveProfile();
  const [uses, setUses] = useState<Use[] | null>(null);
  const left = profile?.ai_credits ?? 12;

  const load = useCallback(async () => {
    const { data } = await supabase.from('ai_usage').select('id, action, credits, project_id, created_at').order('created_at', { ascending: false }).limit(20);
    setUses((data as Use[]) ?? []);
  }, []);
  useEffect(() => {
    let live = true;
    supabase
      .from('ai_usage')
      .select('id, action, credits, project_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => live && setUses((data as Use[]) ?? []));
    return () => {
      live = false;
    };
  }, []);

  function getMore() {
    openSheet(
      <View>
        <Text style={styles.t20}>Get more credits</Text>
        <View style={[styles.card, { backgroundColor: Color.control }]}>
          <View style={styles.row}>
            <Icon name="spark" size={20} color={Color.violet} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>50 credits</Text>
              <Text style={styles.meta}>Never expire · used by every AI tool</Text>
            </View>
            <Text style={styles.mono}>$4.99</Text>
          </View>
        </View>
        <Text style={[styles.meta, { marginTop: 12 }]}>Prototype only · no payment is taken. The credits are added so you can try the AI tools.</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <BigButton
            label="Get 50 credits"
            onPress={async () => {
              closeSheet();
              const err = await save({ ai_credits: left + 50 });
              if (err) {
                toast(err);
                return;
              }
              await supabase.from('ai_usage').insert({ action: 'top_up', credits: 50 });
              load();
              toast('Prototype only · no payment is taken · 50 credits added', undefined, false);
            }}
            style={styles.flex}
          />
          <BigButton label="Not now" tone="control" onPress={closeSheet} style={styles.flex} />
        </View>
      </View>,
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="AI credits" sub="Tidy up, AI write, Translate, AI 4K" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, styles.hero]}>
          <Icon name="spark" size={28} color={Color.violet} />
          <Text style={styles.big}>{left}</Text>
          <Text style={styles.meta}>credits left</Text>
        </View>

        <Text style={styles.sec}>WHAT USES CREDITS</Text>
        <View style={styles.card}>
          {WHAT.map(([k, line], i) => (
            <View key={k} style={[styles.row, i > 0 && styles.rowLine]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{AI_LABEL[k]}</Text>
                <Text style={styles.meta}>{line}</Text>
              </View>
              <Text style={styles.mono}>
                {AI_COST[k]} credit{AI_COST[k] === 1 ? '' : 's'}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sec}>RECENT</Text>
        <View style={styles.card}>
          {uses === null ? (
            <Text style={[styles.meta, { padding: 14 }]}>Loading…</Text>
          ) : uses.length === 0 ? (
            <Text style={[styles.meta, { padding: 14 }]}>Nothing yet. Your AI use shows up here.</Text>
          ) : (
            uses.map((u, i) => (
              <View key={u.id} style={[styles.row, i > 0 && styles.rowLine]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{AI_LABEL[u.action] ?? u.action}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {projects.find((p) => p.id === u.project_id)?.name ?? (u.action === 'top_up' ? 'Top up' : 'Duoreels')} · {inboxTime(u.created_at)}
                  </Text>
                </View>
                <Text style={[styles.mono, u.credits > 0 && { color: Color.green }]}>
                  {u.credits > 0 ? '+' : ''}
                  {u.credits}
                </Text>
              </View>
            ))
          )}
        </View>

        <BigButton label="Get more credits" onPress={getMore} style={{ marginTop: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  hero: { alignItems: 'center', paddingVertical: 20, marginTop: 4, gap: 2 },
  big: { fontFamily: Font.display, fontSize: 64, lineHeight: 66, paddingTop: 6, color: Color.white },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 4, marginBottom: 12 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  mono: { fontFamily: Font.mono, fontSize: 14, lineHeight: 20, color: Color.white },
  sec: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 22, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
});
