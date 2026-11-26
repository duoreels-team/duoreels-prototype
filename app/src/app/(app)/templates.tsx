/**
 * NEW · Brief templates: your saved briefs. Tap to edit, swipe left to delete,
 * "New template" to add. Used by "Use a template" in New project.
 */
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { TemplateSheet } from '@/components/templates/template-sheet';
import { Color, Font, Space } from '@/constants/brand';
import { deleteTemplate, fetchTemplates, saveTemplate, type Template } from '@/lib/templates';
import { useOverlay } from '@/providers/overlay-provider';

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const { openSheet, closeSheet, toast } = useOverlay();
  const [list, setList] = useState<Template[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const r = await fetchTemplates();
    setError(!!r.error);
    setList(r.list);
  }, []);
  useEffect(() => {
    let live = true;
    fetchTemplates().then((r) => {
      if (!live) return;
      setError(!!r.error);
      setList(r.list);
    });
    return () => {
      live = false;
    };
  }, []);

  async function remove(t: Template) {
    closeSheet();
    setList((l) => (l ?? []).filter((x) => x.id !== t.id));
    const { error: err } = await deleteTemplate(t.id);
    if (err) {
      toast("Couldn't delete · check your connection");
      load();
      return;
    }
    toast(`${t.title} deleted`, async () => {
      await saveTemplate({ title: t.title, brief: t.brief, type: t.type, references_text: t.references_text });
      load();
    });
  }

  function edit(t?: Template) {
    openSheet(
      <TemplateSheet
        template={t}
        onSaved={() => {
          closeSheet();
          load();
          toast(t ? 'Template saved' : 'Template added');
        }}
        onDelete={t ? () => remove(t) : undefined}
      />,
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Brief templates" sub={list ? `${list.length} saved · swipe left to delete` : 'Loading…'} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        {error && <Text style={[styles.meta, { marginBottom: 10 }]}>Couldn&apos;t load templates. Run 009 in Supabase, then come back.</Text>}
        {list && list.length === 0 && !error && (
          <View style={styles.empty}>
            <Icon name="doc" size={32} color={Color.meta} />
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={[styles.meta, { textAlign: 'center' }]}>Save a brief you use often, then drop it into any new project.</Text>
          </View>
        )}
        <View style={{ gap: 10, marginTop: 4 }}>
          {(list ?? []).map((t) => (
            <Animated.View key={t.id} layout={LinearTransition.duration(250)} exiting={FadeOut.duration(220)}>
              <Swipeable
                friction={1.6}
                rightThreshold={44}
                overshootRight={false}
                renderRightActions={(_p, _tr, methods) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${t.title}`}
                    onPress={() => {
                      methods.close();
                      remove(t);
                    }}
                    style={styles.del}>
                    <Icon name="trash" size={20} />
                    <Text style={styles.delText}>Delete</Text>
                  </Pressable>
                )}>
                <Pressable accessibilityRole="button" onPress={() => edit(t)} style={styles.card}>
                  <Icon name="doc" size={22} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{t.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {t.type} · {t.brief.split('\n')[0] || 'No brief yet'}
                    </Text>
                  </View>
                  <Icon name="chev" size={18} />
                </Pressable>
              </Swipeable>
            </Animated.View>
          ))}
        </View>
        <BigButton label="New template" onPress={() => edit()} style={{ marginTop: 18 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: Color.surface },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  del: { width: 88, marginLeft: 8, borderRadius: 12, backgroundColor: Color.control, alignItems: 'center', justifyContent: 'center', gap: 4 },
  delText: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
});
