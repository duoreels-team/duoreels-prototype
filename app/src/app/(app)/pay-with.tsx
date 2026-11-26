/**
 * NEW · Pay with: Apple Pay (default) and "Add a card". No real payment is taken.
 */
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { useOverlay } from '@/providers/overlay-provider';

export default function PayWith() {
  const insets = useSafeAreaInsets();
  const { toast } = useOverlay();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Pay with" sub="Used for up-front and approval payments" />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { marginTop: 4 }]}>
          <View style={styles.row}>
            <Icon name="money" size={22} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Apple Pay</Text>
              <Text style={styles.meta}>Default</Text>
            </View>
            <Icon name="check" size={18} color={Color.violet} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => toast('Prototype only · no payment is taken', undefined, false)} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
            <Icon name="plus" size={22} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Add a card</Text>
              <Text style={styles.meta}>Visa, Mastercard, Amex</Text>
            </View>
            <Icon name="chev" size={18} />
          </Pressable>
        </View>
        <Text style={[styles.meta, { marginTop: 14 }]}>Duoreels holds the money and releases it the moment a round is approved. Service fee 5%.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 12, backgroundColor: Color.surface, overflow: 'hidden' },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowPressed: { backgroundColor: '#26262A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
});
