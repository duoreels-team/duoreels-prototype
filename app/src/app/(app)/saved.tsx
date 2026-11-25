/**
 * NEW · Saved editors: the editors you hearted. Tap to open, swipe left to unsave.
 * Reached from Marketplace ("Saved · N") and from Me.
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { ReelTile } from '@/components/market/bits';
import { Color, Font, Space } from '@/constants/brand';
import { reviewsOf, toggleSaved, useMarket } from '@/lib/market';
import { person } from '@/lib/people';
import { useOverlay } from '@/providers/overlay-provider';

export default function SavedEditors() {
  const insets = useSafeAreaInsets();
  const market = useMarket();
  const { toast } = useOverlay();
  const saved = market.saved.map((k) => market.editors.find((e) => e.key === k)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Saved editors" sub={saved.length ? `${saved.length} saved · swipe left to remove` : 'Tap the heart on an editor to save them'} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        {saved.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="heart" size={32} color={Color.meta} />
            <Text style={styles.emptyTitle}>Nobody saved yet</Text>
            <Text style={[styles.meta, { textAlign: 'center' }]}>Editors you heart in Marketplace show up here.</Text>
            <BigButton label="Find editors" tone="control" onPress={() => router.navigate('/market')} style={{ alignSelf: 'stretch', marginTop: 16 }} />
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 6 }}>
            {saved.map((e) => (
              <Animated.View key={e.key} layout={LinearTransition.duration(250)} exiting={FadeOut.duration(220)}>
                <Swipeable
                  friction={1.6}
                  rightThreshold={44}
                  overshootRight={false}
                  renderRightActions={(_p, _t, methods) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${e.name}`}
                      onPress={async () => {
                        methods.close();
                        await toggleSaved(e.key);
                        toast(`${person(e.key).name} removed from Saved`, () => toggleSaved(e.key));
                      }}
                      style={styles.remove}>
                      <Icon name="heart" size={20} />
                      <Text style={styles.removeText}>Unsave</Text>
                    </Pressable>
                  )}>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/editor/${e.key}`)} style={styles.card}>
                    <Avatar k={e.key} size={40} />
                    <View style={styles.flex}>
                      <Text style={styles.name}>{e.name}</Text>
                      <Text style={styles.meta}>
                        <Icon name="star" size={11} color={Color.violet} /> {e.stars.toFixed(1)} ({reviewsOf(e.key).length}) · {e.style}
                      </Text>
                      <Text style={styles.meta}>from ${e.price}</Text>
                    </View>
                    <View style={{ width: 44 }}>
                      <ReelTile img={e.reels[0]} />
                    </View>
                  </Pressable>
                </Swipeable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: Color.surface },
  name: { fontFamily: Font.semibold, fontSize: 16, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  remove: { width: 88, marginLeft: 8, borderRadius: 12, backgroundColor: Color.control, alignItems: 'center', justifyContent: 'center', gap: 4 },
  removeText: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
});
