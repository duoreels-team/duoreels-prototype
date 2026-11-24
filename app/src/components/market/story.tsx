/**
 * Reel viewer (prototype act.story): full screen, progress bars on top,
 * tap right = next, tap left = back, swipe down = close, "Message <name>".
 * The prototype's reels are photos, so each shows for 4 s like the prototype.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar, BigButton, IconButton } from '@/components/brand/bits';
import { reelSource } from '@/components/market/bits';
import { Color, Font } from '@/constants/brand';
import type { Editor } from '@/lib/market';
import { person } from '@/lib/people';

const SHOW_MS = 4000;

function ProgressBar({ state }: { state: 'done' | 'run' | 'next' }) {
  const w = useSharedValue(state === 'done' ? 1 : 0);
  useEffect(() => {
    cancelAnimation(w);
    if (state === 'run') {
      w.value = 0;
      w.value = withTiming(1, { duration: SHOW_MS, easing: Easing.linear });
    } else w.value = state === 'done' ? 1 : 0;
  }, [state, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

export function ReelViewer({ editor, start, onClose }: { editor: Editor; start: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(start);
  const dy = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (i + 1 >= editor.reels.length) onClose();
      else setI(i + 1);
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [i, editor.reels.length, onClose]);

  const swipe = usePanGesture({
    activeOffsetY: 12,
    onUpdate: (e) => {
      'worklet';
      dy.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120) scheduleOnRN(onClose);
      else dy.value = withSpring(0);
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }], opacity: 1 - Math.min(0.5, dy.value / height) }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.story, sheet]}>
          {reelSource(editor.reels[i]) && <Image source={reelSource(editor.reels[i])} style={StyleSheet.absoluteFill} contentFit="cover" />}
          {/* tap left half = back, right half = next */}
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Pressable accessibilityLabel="Previous reel" style={{ width: width * 0.35 }} onPress={() => setI((x) => Math.max(0, x - 1))} />
              <Pressable accessibilityLabel="Next reel" style={{ flex: 1 }} onPress={() => (i + 1 >= editor.reels.length ? onClose() : setI(i + 1))} />
            </View>
          </View>
          <View style={[styles.prog, { top: insets.top + 6 }]} pointerEvents="none">
            {editor.reels.map((r, j) => (
              <ProgressBar key={`${r}-${j < i ? 'd' : j === i ? `r${i}` : 'n'}`} state={j < i ? 'done' : j === i ? 'run' : 'next'} />
            ))}
          </View>
          <View style={[styles.head, { top: insets.top + 18 }]}>
            <Avatar k={editor.key} size={28} />
            <Text style={styles.name}>{editor.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {editor.style} · {editor.durations[i]}
            </Text>
            <View style={{ flex: 1 }} />
            <IconButton name="close" label="Close" onPress={onClose} />
          </View>
          <View style={[styles.foot, { bottom: insets.bottom + 24 }]}>
            <BigButton
              label={`Message ${person(editor.key).name}`}
              tone="white"
              onPress={() => {
                onClose();
                router.push(`/thread/${editor.key}`);
              }}
            />
            <Text style={[styles.meta, { textAlign: 'center', marginTop: 8, color: '#DDDDDD' }]}>Tap for the next reel · swipe down to close</Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  story: { flex: 1, backgroundColor: Color.black },
  prog: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: Color.white },
  head: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, flexShrink: 1 },
  foot: { position: 'absolute', left: 16, right: 16 },
});
