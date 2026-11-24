/**
 * Marketplace (prototype V.market): Blinds photo that fades out, title, messages,
 * search that really filters, filter sheet with chips + badge, editor cards.
 * NEW: "Saved · N" entry and a "No editors match" empty state.
 */
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, IconButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { MarketFilterSheet, ReelTile } from '@/components/market/bits';
import { Color, Font, Space } from '@/constants/brand';
import { filterEditors, reviewsOf, useMarket, type Sort } from '@/lib/market';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { useOverlay } from '@/providers/overlay-provider';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const slideIn = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
  })
    .duration(550)
    .delay(i * 40);

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const market = useMarket();
  const { openSheet, closeSheet } = useOverlay();
  const [q, setQ] = useState('');
  const [mf, setMf] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('Best match');
  const glass = useSharedValue(0);
  const glassStyle = useAnimatedStyle(() => ({ opacity: withTiming(glass.value, { duration: 300 }) }));

  const list = useMemo(() => filterEditors(market.editors, q, mf, sort), [market.editors, q, mf, sort]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 54, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          const on = e.nativeEvent.contentOffset.y > 6 ? 1 : 0;
          if (glass.value !== on) glass.value = on;
        }}>
        {/* .mk-blinds: the photo, solid to 150 px, gone by 240 px */}
        <View style={styles.blinds} pointerEvents="none">
          <Image source={SAMPLE_IMAGES['mk-blinds']} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', Color.black]} locations={[0, 150 / 240, 1]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.pad}>
          <Text style={styles.ptitle}>MARKETPLACE</Text>

          <View style={styles.searchRow}>
            <View style={styles.field}>
              <Icon name="search" size={18} color={Color.meta} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder='Search a style, e.g. "cozy vlog"'
                placeholderTextColor={Color.meta}
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                returnKeyType="search"
                autoCorrect={false}
                style={styles.input}
              />
              {q.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={10}>
                  <Icon name="close" size={16} color={Color.meta} />
                </Pressable>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter"
              onPress={() =>
                openSheet(
                  <MarketFilterSheet
                    editors={market.editors}
                    q={q}
                    value={mf}
                    sort={sort}
                    onShow={(chips, s) => {
                      setMf(chips);
                      setSort(s);
                      closeSheet();
                    }}
                  />,
                )
              }
              style={[styles.filterBtn, mf.length > 0 && styles.filterOn]}>
              <Icon name="filter" size={18} color={mf.length ? Color.black : Color.white} />
              {mf.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{mf.length}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {mf.length > 0 && (
            <View style={styles.chips}>
              {mf.map((a) => (
                <Pressable key={a} accessibilityRole="button" accessibilityLabel={`Remove ${a}`} onPress={() => setMf((m) => m.filter((x) => x !== a))} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                  <Icon name="close" size={13} strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          )}

          {/* NEW · Saved editors */}
          <Pressable accessibilityRole="button" onPress={() => router.push('/saved')} style={({ pressed }) => [styles.savedRow, pressed && { backgroundColor: '#26262A' }]}>
            <Icon name={market.saved.length ? 'heart-filled' : 'heart'} size={18} color={market.saved.length ? Color.violet : Color.text2} />
            <Text style={[styles.lab, { flex: 1 }]}>Saved · {market.saved.length}</Text>
            <Icon name="chev" size={16} />
          </Pressable>

          {market.status === 'loading' ? (
            <ActivityIndicator color={Color.violet} style={{ marginTop: 40 }} />
          ) : market.status === 'error' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Couldn&apos;t load editors</Text>
              <Text style={styles.meta}>Check your connection, or run 009 in Supabase.</Text>
            </View>
          ) : list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No editors match</Text>
              <Text style={styles.meta}>Try another style or fewer filters.</Text>
              <BigButton
                label="Clear"
                tone="control"
                onPress={() => {
                  setQ('');
                  setMf([]);
                  setSort('Best match');
                }}
                style={{ alignSelf: 'stretch', marginTop: 16 }}
              />
            </View>
          ) : (
            <View style={{ gap: 14, marginTop: 16 }}>
              {list.map((e, i) => (
                <Animated.View key={e.key} entering={slideIn(i)}>
                  <Pressable accessibilityRole="button" accessibilityLabel={e.name} onPress={() => router.push(`/editor/${e.key}`)} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.99 }] }]}>
                    <View style={styles.cardTop}>
                      <Avatar k={e.key} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {e.name} <Icon name="star" size={12} color={Color.violet} />
                          <Text style={styles.meta}>
                            {' '}
                            {e.stars.toFixed(1)} ({reviewsOf(e.key).length})
                          </Text>
                        </Text>
                        <Text style={styles.meta}>{e.style}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.price}>${e.price}</Text>
                        <Text style={styles.meta}>from · 2 rounds</Text>
                      </View>
                    </View>
                    <View style={styles.reels}>
                      {e.reels.slice(0, 3).map((r, j) => (
                        <View key={r} style={{ flex: 1 }}>
                          <ReelTile img={r} dur={e.durations[j]} />
                        </View>
                      ))}
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, glassStyle]} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        </Animated.View>
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          <IconButton name="chat" label="Messages" onPress={() => router.push('/activity')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  blinds: { position: 'absolute', left: 0, right: 0, top: 0, height: 240 },
  fixedTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, overflow: 'hidden' },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10 },
  ptitle: { fontFamily: Font.display, fontSize: 48, lineHeight: 50, paddingTop: 4, letterSpacing: 0.24, color: Color.white },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  field: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Color.surface },
  input: { flex: 1, minWidth: 0, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  filterBtn: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42', alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: Color.white, borderColor: Color.white },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Color.violet, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: Font.bold, fontSize: 14, lineHeight: 18, color: Color.black },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42' },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, marginTop: 12, borderRadius: 12, backgroundColor: Color.surface },
  card: { padding: 12, borderRadius: 12, backgroundColor: Color.surface },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  price: { fontFamily: Font.display, fontSize: 26, lineHeight: 30, paddingTop: 2, color: Color.white },
  reels: { flexDirection: 'row', gap: 6, marginTop: 12 },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
});
