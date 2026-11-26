/**
 * The bell → Messages (prototype V.activity): project updates and chats with editors.
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/brand/bits';
import { PageTop } from '@/components/brand/top-bar';
import { AskSheet } from '@/components/review/project-sheets';
import { Color, Font, Space } from '@/constants/brand';
import { person } from '@/lib/people';
import { EDITOR_LAST, inboxTime, type Activity } from '@/lib/review';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

const slideIn = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
  })
    .duration(550)
    .delay(Math.min(i, 7) * 40);

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { activity, projects, reloadActivity } = useProjects();
  const { openSheet } = useOverlay();
  const unread = activity.filter((a) => a.unread).length;

  useEffect(() => {
    reloadActivity();
  }, [reloadActivity]);

  function open(a: Activity) {
    const project = projects.find((p) => p.id === a.project_id);
    if (a.action === 'ask' && project?.asks_extra_day) {
      openSheet(<AskSheet projectId={project.id} />);
      return;
    }
    if (a.project_id && project) {
      router.push(`/project/${a.project_id}`);
      return;
    }
    router.push(`/thread/${a.by_key}`);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Messages" sub={unread ? `${unread} unread` : 'All caught up'} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.list}>
          {activity.map((a, i) => {
            const who = person(a.by_key);
            const proj = projects.find((p) => p.id === a.project_id)?.name;
            const last = EDITOR_LAST[a.by_key] ?? '';
            return (
              <Animated.View key={a.id} entering={slideIn(i)}>
                <Pressable accessibilityRole="button" onPress={() => open(a)} style={({ pressed }) => [styles.mrow, i > 0 && styles.rowLine, pressed && { backgroundColor: '#26262A' }]}>
                  <Avatar k={a.by_key} size={44} />
                  <View style={styles.tx}>
                    <View style={styles.ml1}>
                      <Text style={styles.name}>
                        {a.by_key === 'M' ? 'You' : `${who.name}${last ? ` ${last}` : ''}`}
                      </Text>
                      {proj && (
                        <Text style={styles.mproj} numberOfLines={1}>
                          · {proj}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.mtxt, a.unread && { color: '#EEEEEE' }]} numberOfLines={1}>
                      {a.body}
                    </Text>
                  </View>
                  <View style={styles.mr}>
                    <Text style={styles.mtime}>{inboxTime(a.created_at)}</Text>
                    <View style={[styles.dot, !a.unread && { opacity: 0 }]} />
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
          {!activity.length && <Text style={styles.empty}>Nothing needs you now.</Text>}
        </View>
        <Text style={[styles.meta, { marginTop: 14 }]}>Project updates and chats with editors, in one place.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  list: { marginTop: 6, backgroundColor: Color.surface, borderRadius: 12, overflow: 'hidden' },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  tx: { flex: 1, minWidth: 0, gap: 3 },
  ml1: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 },
  name: { fontFamily: Font.semibold, fontSize: 16, lineHeight: 20, color: Color.white, flexShrink: 0 },
  mproj: { flex: 1, minWidth: 0, fontFamily: Font.regular, fontSize: 14, lineHeight: 18, color: Color.text2 },
  mtxt: { fontFamily: Font.regular, fontSize: 15, lineHeight: 20, color: Color.text2 },
  mr: { alignItems: 'flex-end', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  mtime: { fontFamily: Font.regular, fontSize: 14, lineHeight: 18, color: Color.text2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Color.violet },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  empty: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, textAlign: 'center', paddingVertical: 30 },
});
