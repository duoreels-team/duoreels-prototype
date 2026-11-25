/**
 * Creator Home — matches the HTML prototype (index.html, V.home) as of 11.24:
 * stripe header, slanted New project button, one In progress list
 * (v · editor · due M.D, slanted tags: violet = new, yellow = reply by),
 * Marketplace row, Done rail. Data is sample data until projects live in Supabase.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/brand/ui';
import { LogoMark } from '@/components/brand/logo-mark';
import { Color, Font, Space, Type } from '@/constants/brand';
import { useAuth } from '@/providers/auth-provider';

const IMG = {
  mr: require('@/assets/projects/mr.jpg'),
  s08: require('@/assets/projects/s08.jpg'),
  pu: require('@/assets/projects/pu.jpg'),
  wed: require('@/assets/projects/wed.jpg'),
  gym: require('@/assets/projects/gym.jpg'),
  s24: require('@/assets/projects/s24.jpg'),
  c1: require('@/assets/projects/c1.jpg'),
  c2: require('@/assets/projects/c2.jpg'),
  c3: require('@/assets/projects/c3.jpg'),
  c4: require('@/assets/projects/c4.jpg'),
};
type Img = keyof typeof IMG;

const PEOPLE: Record<string, { n: string; c: string }> = {
  L: { n: 'Leo', c: Color.blue },
  J: { n: 'Jon', c: '#FF9A4D' },
  F: { n: 'Fay', c: '#2EC4B6' },
  K: { n: 'Kim', c: '#C08BFF' },
};

type Tag = { text: string; tone: 'violet' | 'yellow' };
type Project = { id: string; title: string; img: Img; dur: number; ver: string; ed: string; eds?: string[]; due: string; tag?: Tag };

// "In progress" — projects that need you first, then by due date.
const IN_PROGRESS: Project[] = [
  { id: 'mr', title: 'Morning routine', img: 'mr', dur: 84, ver: 'v3', ed: 'L', due: '11.28', tag: { text: 'NEW V3', tone: 'violet' } },
  { id: 'sun', title: 'Sunday reset', img: 's08', dur: 76, ver: 'v1', ed: 'L', due: '11.23', tag: { text: '2 NEW MESSAGES', tone: 'violet' } },
  { id: 'pu', title: 'Product unboxing', img: 'pu', dur: 67, ver: 'v3', ed: 'J', eds: ['J', 'F', 'K'], due: '11.23' },
  { id: 'wed', title: 'Wedding teaser', img: 'wed', dur: 138, ver: 'v1', ed: 'L', due: '11.27' },
  { id: 'gym', title: 'Gym promo', img: 'gym', dur: 49, ver: 'Final', ed: 'J', due: '11.27' },
  { id: 'mf', title: 'Monthly favorites', img: 's24', dur: 103, ver: 'v2', ed: 'J', due: '11.24' },
];
const GROUPS = [
  { label: 'YOUR TURN', dot: Color.violet, items: IN_PROGRESS.filter((p) => p.tag) },
  { label: 'WITH EDITORS', dot: Color.meta, items: IN_PROGRESS.filter((p) => !p.tag) },
];
const DONE: { title: string; img: Img; dur: number; date: string }[] = [
  { title: 'Latte afternoon', img: 'c1', dur: 95, date: '10.30' },
  { title: 'Market day', img: 'c2', dur: 71, date: '10.21' },
  { title: 'Picnic with Mochi', img: 'c3', dur: 126, date: '10.12' },
  { title: 'Rainy night walk', img: 'c4', dur: 58, date: '10.2' },
];

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const onLogo = () =>
    Alert.alert('Switch account', 'Maya · Creator', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  const soon = (what: string) => Alert.alert(what, 'Opens in the next build. Try it in the web prototype for now.');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* stripe header — same picture as the prototype's .mk-blinds */}
        <Image source={require('@/assets/brand/stripes.png')} style={styles.stripes} contentFit="cover" pointerEvents="none" />

        <View style={styles.header}>
          <Pressable onPress={onLogo} hitSlop={10} accessibilityLabel="Duoreels · switch account">
            <LogoMark size={30} />
          </Pressable>
          <Pressable onPress={() => soon('Messages')} hitSlop={10} accessibilityLabel="Messages">
            <Icon name="bell" size={24} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        <View style={styles.pad}>
          <Pressable onPress={() => soon('New project')} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={styles.newBtnInner}>
              <Icon name="plus" size={20} color={Color.black} strokeWidth={2.6} />
              <Text style={styles.newBtnText}>NEW PROJECT</Text>
            </View>
          </Pressable>

          <View style={styles.sec}>
            <Text style={styles.secText}>IN PROGRESS · {IN_PROGRESS.length}</Text>
            <Pressable onPress={() => soon('All projects')} hitSlop={8}>
              <Text style={styles.secLink}>See all ›</Text>
            </Pressable>
          </View>

          {/* two blocks with a small gap: what needs you, then what editors are working on */}
          <View>
            {GROUPS.map((g, gi) => (
              <View key={g.label} style={[styles.list, gi > 0 && { marginTop: 12 }]}>
            {g.items.map((p, i) => (
              <Pressable key={p.id} onPress={() => soon(p.title)} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { backgroundColor: Color.surfaceSelected }]}>
                <View>
                  <Image source={IMG[p.img]} style={styles.thumb} contentFit="cover" />
                  <View style={styles.dur}><Text style={styles.durText}>{mmss(p.dur)}</Text></View>
                </View>
                <View style={styles.tx}>
                  <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{p.ver} · {PEOPLE[p.ed].n} · due {p.due}</Text>
                  {p.tag ? <SlantTag tag={p.tag} /> : null}
                </View>
                <View style={styles.avs}>
                  {(p.eds ?? [p.ed]).map((k, j) => (
                    <View key={k} style={[styles.av, { backgroundColor: PEOPLE[k].c, marginLeft: j ? -7 : 0 }]}>
                      <Text style={styles.avText}>{k}</Text>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => soon('More')} hitSlop={8} style={styles.more}>
                  <Icon name="more" size={20} color={Color.text2} />
                </Pressable>
              </Pressable>
            ))}
              </View>
            ))}

          </View>

          <Pressable onPress={() => soon('Marketplace')} style={styles.mkRow}>
            <Icon name="bag" size={20} color={Color.text2} />
            <Text style={styles.mkText}>Need an editor? Find one in Marketplace</Text>
            <Icon name="chev" size={18} />
          </Pressable>

          <View style={styles.sec}>
            <Text style={styles.secText}>DONE · 22</Text>
            <Pressable onPress={() => soon('All projects')} hitSlop={8}>
              <Text style={styles.secLink}>See all ›</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {DONE.map((d) => (
            <Pressable key={d.title} onPress={() => soon(d.title)} style={{ width: 112 }}>
              <View>
                <Image source={IMG[d.img]} style={styles.cover} contentFit="cover" />
                <View style={styles.dur}><Text style={styles.durText}>{mmss(d.dur)}</Text></View>
              </View>
              <Text style={styles.coverTitle} numberOfLines={1}>{d.title}</Text>
              <Text style={styles.meta}>{d.date}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

/** Slanted tag like the logo: violet = something new, yellow = needs your reply by a date. */
function SlantTag({ tag }: { tag: Tag }) {
  return (
    <View style={[styles.tag, { backgroundColor: tag.tone === 'violet' ? Color.violet : Color.yellow }]}>
      <Text style={styles.tagText}>{tag.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  stripes: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.screenEdge },
  bellDot: { position: 'absolute', top: 1, right: 1, width: 8, height: 8, borderRadius: 4, backgroundColor: Color.white },
  pad: { paddingHorizontal: Space.screenEdge },
  newBtn: { height: 48, backgroundColor: Color.violet, transform: [{ skewX: '-14deg' }], marginHorizontal: 6, justifyContent: 'center' },
  newBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, transform: [{ skewX: '14deg' }] },
  newBtnText: { ...Type.mainButton, color: Color.black },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  secText: { fontFamily: Font.semibold, fontSize: 14, letterSpacing: 1.4, color: Color.meta },
  secLink: { fontFamily: Font.semibold, fontSize: 15, color: Color.white },
  list: { backgroundColor: Color.surface, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2a2e' },
  thumb: { width: 48, height: 64, borderRadius: 8 },
  dur: { position: 'absolute', left: 4, bottom: 4, height: 18, paddingHorizontal: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 12, color: Color.white },
  tx: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...Type.row, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, color: Color.meta },
  tag: { alignSelf: 'flex-start', marginTop: 4, height: 22, paddingHorizontal: 10, justifyContent: 'center', transform: [{ skewX: '-14deg' }] },
  tagText: { ...Type.tag, fontSize: 14, color: Color.black, transform: [{ skewX: '14deg' }] },
  subsec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 2 },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  subText: { fontFamily: Font.semibold, fontSize: 13, letterSpacing: 1, color: Color.meta },
  avs: { flexDirection: 'row' },
  av: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Color.surface },
  avText: { fontFamily: Font.bold, fontSize: 11, color: Color.black },
  more: { width: 28, alignItems: 'center' },
  seeAll: { fontFamily: Font.semibold, fontSize: 15, color: Color.white },
  mkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, backgroundColor: Color.surface, borderRadius: 16 },
  mkText: { flex: 1, fontFamily: Font.semibold, fontSize: 15, color: Color.white },
  rail: { gap: 8, paddingHorizontal: Space.screenEdge },
  cover: { width: 112, height: 150, borderRadius: 12 },
  coverTitle: { fontFamily: Font.semibold, fontSize: 14, color: Color.white, marginTop: 7 },
});
