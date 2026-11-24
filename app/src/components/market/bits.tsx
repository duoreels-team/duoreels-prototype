/**
 * Marketplace pieces: stars, a reel tile, the filter sheet (prototype mfilter).
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton, Chip } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { CATEGORIES, filterEditors, PRICES, type Editor, type Sort } from '@/lib/market';
import { SAMPLE_IMAGES } from '@/lib/sample-images';

export function reelSource(key: string) {
  return SAMPLE_IMAGES[key as keyof typeof SAMPLE_IMAGES] ?? null;
}

export function Stars({ n, size = 13, total = 5 }: { n: number; size?: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: total }, (_, i) => (
        <Icon key={i} name="starf" size={size} color={i < n ? Color.violet : '#3A3A42'} />
      ))}
    </View>
  );
}

export function ReelTile({ img, dur, width, onPress }: { img: string; dur?: string; width?: number | `${number}%`; onPress?: () => void }) {
  const inner = (
    <>
      {reelSource(img) && <Image source={reelSource(img)} style={StyleSheet.absoluteFill} contentFit="cover" />}
      {dur ? (
        <View style={styles.dur}>
          <Text style={styles.durText}>{dur}</Text>
        </View>
      ) : null}
    </>
  );
  const style = [styles.reel, width !== undefined && { width }];
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Play reel ${dur ?? ''}`} onPress={onPress} style={style}>
      {inner}
    </Pressable>
  );
}

export function MarketFilterSheet({ editors, q, value, sort, myTypes = [], onShow }: { editors: Editor[]; q: string; value: string[]; sort: Sort; myTypes?: string[]; onShow: (chips: string[], sort: Sort) => void }) {
  const [mf, setMf] = useState(value);
  const [s, setS] = useState<Sort>(sort);
  const n = filterEditors(editors, q, mf, s).length;
  const tog = (v: string) => setMf((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));
  const chip = (v: string) => <Chip key={v} label={v} on={mf.includes(v)} onPress={() => tog(v)} />;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
        <Text style={[styles.t20, { flex: 1 }]}>Filter editors</Text>
        <Pressable accessibilityRole="button" onPress={() => setMf([])} hitSlop={10}>
          <Text style={[styles.lab, { color: Color.meta }]}>Clear</Text>
        </Pressable>
      </View>
      <Text style={styles.lbl}>CATEGORY</Text>
      <View style={styles.chips}>{[...CATEGORIES, ...myTypes.filter((t) => !CATEGORIES.includes(t))].map(chip)}</View>
      <Text style={styles.lbl}>PRICE PER VIDEO</Text>
      <View style={styles.chips}>{PRICES.map(chip)}</View>
      <Text style={styles.lbl}>SORT</Text>
      <View style={styles.seg}>
        {(['Best match', 'Cheapest', 'Top rated'] as Sort[]).map((x) => (
          <Pressable key={x} accessibilityRole="button" accessibilityState={{ selected: s === x }} onPress={() => setS(x)} style={[styles.segBtn, s === x && styles.segOn]}>
            <Text style={[styles.segText, s === x && { color: Color.black }]}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <BigButton label={`Show ${n} editor${n === 1 ? '' : 's'}`} onPress={() => onShow(mf, s)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reel: { aspectRatio: 9 / 13, borderRadius: 8, overflow: 'hidden', backgroundColor: Color.surface },
  dur: { position: 'absolute', left: 4, bottom: 4, height: 20, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.white },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
});
