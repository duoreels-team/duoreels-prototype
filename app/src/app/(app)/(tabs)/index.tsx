/**
 * Home (prototype V.home): logo + bell, hero light behind "+ New project",
 * In progress (needs-you cards, then waiting rows), Marketplace link, Done rail.
 */
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarStack, Cover34, IconButton, Section, SlantButton, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { MainButton } from '@/components/brand/ui';
import { EditorHome } from '@/components/editor/editor-home';
import { LogoButton } from '@/components/brand/role-sheet';
import { StripeHeader } from '@/components/brand/stripe-header';
import { useViewRole } from '@/providers/view-role';
import { ProjectSheet } from '@/components/home/project-sheet';
import { Color, Font, Space, Type } from '@/constants/brand';
import { finishedLabel, homeOrder, metaLine, needsYou, tagFor, type Project } from '@/lib/projects';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

const HEADER = 54;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

/** .stag: each card slides in from the lower left, 40 ms apart. */
const slideIn = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
  })
    .duration(550)
    .delay(i * 40);

const openProject = (id: string) => router.push(`/project/${id}`);

export default function HomeTab() {
  const { role } = useViewRole();
  return role === 'editor' ? <EditorHome /> : <HomeScreen />;
}

function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Done rail: 3 cards across with the 4th peeking (prototype .rail, 112 pt on a 390 phone).
  const { width: screenW } = useWindowDimensions();
  const railW = Math.floor((screenW - Space.screenEdge - 2 * 10 - 26) / 3);
  const { status, error, projects, activity, reload, update, removeLater } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();
  const [retrying, setRetrying] = useState(false);

  const glass = useSharedValue(0);
  const glassStyle = useAnimatedStyle(() => ({ opacity: withTiming(glass.value, { duration: 300 }) }));

  const { prog, mine, rest, done } = useMemo(() => {
    const inProgress = projects.filter((p) => p.status === 'in_progress');
    return {
      prog: inProgress,
      mine: inProgress.filter(needsYou).sort((a, b) => homeOrder(a) - homeOrder(b)),
      rest: inProgress.filter((p) => !needsYou(p)),
      done: projects.filter((p) => p.status === 'done'),
    };
  }, [projects]);

  // The bell's dot: something new is waiting for you.
  const unread = activity.some((a) => a.unread);

  const more = (p: Project) =>
    openSheet(<ProjectSheet project={p} actions={{ close: closeSheet, open: openSheet, toast, update, removeLater }} />);

  const top = insets.top + HEADER;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {status === 'ready' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingTop: top, paddingBottom: 110 }}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const on = e.nativeEvent.contentOffset.y > 6 ? 1 : 0;
            if (glass.value !== on) glass.value = on;
          }}>
          <StripeHeader />
          <View style={styles.pad}>
            <SlantButton label="New project" icon="plus" onPress={() => router.push('/new-project')} />

            <Section title={`In progress · ${prog.length}`} action="See all ›" onAction={() => router.push({ pathname: '/all', params: { status: 'progress' } })} style={{ marginTop: 24 }} />

            {mine.map((p, i) => (
              <Animated.View key={p.id} entering={slideIn(i)}>
                <HomeRow project={p} onPress={() => openProject(p.id)} onMore={() => more(p)} />
              </Animated.View>
            ))}

            <View style={[styles.list, { marginTop: mine.length ? 18 : 0 }]}>
              {rest.map((p, i) => (
                <WaitRow key={p.id} project={p} first={i === 0} onPress={() => openProject(p.id)} onMore={() => more(p)} />
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/all', params: { status: 'progress' } })}
                style={({ pressed }) => [styles.row, styles.seeAll, rest.length > 0 && styles.rowLine, pressed && styles.rowPressed]}>
                <Text style={styles.lab}>See all {prog.length} in progress</Text>
                <Icon name="chev" size={16} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/market')}
              style={({ pressed }) => [styles.row, styles.card, { marginTop: 16 }, pressed && styles.rowPressedCard]}>
              <Icon name="bag" size={20} color={Color.text2} />
              <Text style={[styles.lab, styles.flex]}>Need an editor? Find one in Marketplace</Text>
              <Icon name="chev" size={18} />
            </Pressable>

            <Section title={`Done · ${done.length}`} action="See all ›" onAction={() => router.push({ pathname: '/all', params: { status: 'done' } })} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
              {done.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => openProject(p.id)} style={{ width: railW }}>
                  <Cover34 project={p} width={railW} radius={10} />
                  <Text style={[styles.lab, { marginTop: 7 }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {finishedLabel(p)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : status === 'loading' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={Color.violet} />
        </View>
      ) : (
        <View style={styles.centre}>
          <Text style={styles.message}>{error}</Text>
          <MainButton
            label="Try again"
            loading={retrying}
            onPress={async () => {
              setRetrying(true);
              await reload();
              setRetrying(false);
            }}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}

      {/* .fixedtop: logo + bell; turns to glass once you scroll. */}
      <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, glassStyle]} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        </Animated.View>
        <View style={styles.header}>
          <View style={styles.flex}>
            <LogoButton />
          </View>
          <IconButton name="bell" label="Messages" onPress={() => router.push('/activity')}>
            {unread && <View style={styles.dot} />}
          </IconButton>
        </View>
      </View>
    </View>
  );
}

/* ---------- needs-you card (.prow.big) ---------- */

function HomeRow({ project: p, onPress, onMore }: { project: Project; onPress: () => void; onMore: () => void }) {
  const [tag, tone] = tagFor(p);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${metaLine(p)}, ${tag.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [styles.prow, pressed && { transform: [{ scale: 0.985 }] }]}>
      <Cover34 project={p} width={76} />
      <View style={styles.prowTx}>
        <Text style={styles.prowTitle} numberOfLines={1}>
          {p.name}
        </Text>
        <Text style={styles.meta}>{metaLine(p)}</Text>
        <Tag label={tag} tone={tone} style={{ marginTop: 3 }} />
      </View>
      <IconButton name="more" label="More" size={20} color={Color.text2} width={30} onPress={onMore} style={{ alignSelf: 'flex-start', marginTop: 2 }} />
    </Pressable>
  );
}

/* ---------- waiting row (.row.wrow) ---------- */

function WaitRow({ project: p, first, onPress, onMore }: { project: Project; first: boolean; onPress: () => void; onMore: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${metaLine(p)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      <Cover34 project={p} width={40} radius={6} showTime={false} />
      <View style={styles.flex}>
        <Text style={styles.wrowTitle} numberOfLines={1}>
          {p.name}
        </Text>
        <Text style={[styles.meta, { marginTop: 2 }]} numberOfLines={1}>
          {metaLine(p)}
        </Text>
      </View>
      <AvatarStack keys={p.editor_keys.length ? p.editor_keys : ['L']} />
      <IconButton name="more" label="More" size={20} color={Color.text2} width={30} onPress={onMore} style={{ marginRight: -6 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Color.black,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pad: {
    paddingHorizontal: Space.screenEdge,
  },
  fixedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  header: {
    height: HEADER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.white,
  },
  prow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    backgroundColor: Color.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  prowTx: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 5,
  },
  prowTitle: {
    fontFamily: Font.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: Color.white,
    maxWidth: '100%',
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
  lab: {
    ...Type.label,
    color: Color.white,
  },
  list: {
    backgroundColor: Color.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  card: {
    backgroundColor: Color.surface,
    borderRadius: 12,
  },
  rowLine: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A2E',
  },
  rowPressed: {
    backgroundColor: '#26262A',
  },
  rowPressedCard: {
    backgroundColor: '#26262A',
    transform: [{ scale: 0.99 }],
  },
  seeAll: {
    justifyContent: 'center',
    gap: 4,
  },
  wrowTitle: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  rail: {
    marginHorizontal: -Space.screenEdge,
  },
  railContent: {
    paddingHorizontal: Space.screenEdge,
    gap: 10,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.screenEdge,
    gap: Space.groups,
  },
  message: {
    ...Type.body,
    color: Color.text2,
    textAlign: 'center',
  },
});
