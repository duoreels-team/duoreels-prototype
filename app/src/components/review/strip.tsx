/**
 * The timeline strip under the video (prototype .strip): 8 frames, pins,
 * range bars, the range box with two handles, and the white playhead.
 *
 * Scrubbing and the range handles run on the UI thread (gesture-handler +
 * reanimated), so dragging stays smooth and the time label updates live.
 * Handles can't cross, the range is at least 1 s and stays inside the video.
 * While you drag, the real video seeks at most every 150 ms, then once more on release.
 *
 * Pins: tap an avatar (44 pt area) to jump to that note. Pins that sit on top of each
 * other are one tap target that hands back all their notes.
 */
import { Image, type ImageSource } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar } from '@/components/brand/bits';
import { Color } from '@/constants/brand';
import { person } from '@/lib/people';

export type Pin = { id: string; t: number; by: string };
export type RangeBar = { t: number; b: number };

type Props = {
  duration: number;
  t: number;
  frames: 'empty' | { picture: ImageSource | null; videoUrl: string | null };
  pins: Pin[];
  ranges: RangeBar[];
  range: { a: number; b: number } | null;
  onSeek: (t: number) => void;
  onRange: (a: number, b: number) => void;
  /** Tap a pin: the ids of the note(s) under your finger. */
  onPin?: (ids: string[]) => void;
  /** The pin that's lit up (the note you jumped to). */
  activePin?: string | null;
  style?: StyleProp<ViewStyle>;
};

const HIT = 44;
/** Room above the strip for the pin avatars (they hang 24 pt above it). */
const PIN_BAND = 26;
/** Seek the real video at most this often while dragging. */
const SEEK_EVERY_MS = 150;

/** Pins closer than this many points share one tap target. */
const CLUSTER_PT = 18;

function clusterPins(pins: Pin[], width: number, duration: number) {
  const sorted = [...pins].sort((x, y) => x.t - y.t);
  const out: { x: number; pins: Pin[] }[] = [];
  for (const p of sorted) {
    const x = (Math.min(duration, Math.max(0, p.t)) / (duration || 1)) * width;
    const last = out[out.length - 1];
    if (last && x - last.x < CLUSTER_PT) last.pins.push(p);
    else out.push({ x, pins: [p] });
  }
  return out;
}

export function Strip({ duration, t, frames, pins, ranges, range, onSeek, onRange, onPin, activePin, style }: Props) {
  const [w, setW] = useState(0);
  const width = useSharedValue(0);
  const dur = useSharedValue(duration || 1);
  const head = useSharedValue(t);
  const scrubbing = useSharedValue(0);
  const a = useSharedValue(range?.a ?? 0);
  const b = useSharedValue(range?.b ?? 1);
  const handleDrag = useSharedValue(0);
  const start = useSharedValue(0);
  const lastSeek = useSharedValue(0);

  useEffect(() => {
    dur.set(duration || 1);
  }, [duration, dur]);
  useEffect(() => {
    if (!scrubbing.get()) head.set(t);
  }, [t, head, scrubbing]);
  useEffect(() => {
    if (range && !handleDrag.get()) {
      a.set(range.a);
      b.set(range.b);
    }
  }, [range, a, b, handleDrag]);

  const seekJS = (time: number) => onSeek(time);
  const rangeJS = (x: number, y: number) => onRange(x, y);

  /* scrub: tap or drag anywhere on the strip (off while the range box is up) */
  const scrub = usePanGesture({
    enabled: !range,
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scrubbing.set(1);
      const time = Math.min(1, Math.max(0, e.x / (width.get() || 1))) * dur.get();
      head.set(time);
      lastSeek.set(Date.now());
      scheduleOnRN(seekJS, time);
    },
    onUpdate: (e) => {
      'worklet';
      // The playhead follows your finger on the UI thread; the video catches up every 150 ms.
      const time = Math.min(1, Math.max(0, e.x / (width.get() || 1))) * dur.get();
      head.set(time);
      const now = Date.now();
      if (now - lastSeek.get() >= SEEK_EVERY_MS) {
        lastSeek.set(now);
        scheduleOnRN(seekJS, time);
      }
    },
    onFinalize: () => {
      'worklet';
      // The exact frame where you let go.
      if (scrubbing.get()) scheduleOnRN(seekJS, head.get());
      scrubbing.set(0);
    },
  });

  /* left handle */
  const dragA = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      handleDrag.set(1);
      start.set(a.get());
    },
    onUpdate: (e) => {
      'worklet';
      const next = Math.round(start.get() + (e.translationX / (width.get() || 1)) * dur.get());
      a.set(Math.min(b.get() - 1, Math.max(0, next)));
      scheduleOnRN(rangeJS, a.get(), b.get());
    },
    onFinalize: () => {
      'worklet';
      handleDrag.set(0);
    },
  });

  /* right handle */
  const dragB = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      handleDrag.set(1);
      start.set(b.get());
    },
    onUpdate: (e) => {
      'worklet';
      const next = Math.round(start.get() + (e.translationX / (width.get() || 1)) * dur.get());
      b.set(Math.max(a.get() + 1, Math.min(Math.floor(dur.get()), next)));
      scheduleOnRN(rangeJS, a.get(), b.get());
    },
    onFinalize: () => {
      'worklet';
      handleDrag.set(0);
    },
  });

  const headStyle = useAnimatedStyle(() => ({ left: (head.get() / dur.get()) * width.get() }));
  const boxStyle = useAnimatedStyle(() => ({ left: (a.get() / dur.get()) * width.get(), width: ((b.get() - a.get()) / dur.get()) * width.get() }));
  const hitA = useAnimatedStyle(() => ({ left: (a.get() / dur.get()) * width.get() - HIT / 2 - 2 }));
  const hitB = useAnimatedStyle(() => ({ left: (b.get() / dur.get()) * width.get() - HIT / 2 + 2 }));

  const pos = (time: number) => `${Math.min(100, Math.max(0, (time / (duration || 1)) * 100))}%` as const;

  const flat = StyleSheet.flatten(style) ?? {};
  const groups = w > 0 && onPin ? clusterPins(pins, w, duration || 1) : [];

  return (
    // The wrapper reaches up over the pin avatars (same place on screen), so they can be tapped.
    <View style={[flat, { marginTop: Number(flat.marginTop ?? 0) - PIN_BAND, paddingTop: PIN_BAND }]} pointerEvents="box-none">
      <GestureDetector gesture={scrub}>
        <Animated.View
          style={styles.strip}
          onLayout={(e: LayoutChangeEvent) => {
            setW(e.nativeEvent.layout.width);
            width.set(e.nativeEvent.layout.width);
          }}>
          <Frames frames={frames} duration={duration} />
          {pins.map((p, i) => (
            <View key={`${p.id}-${i}`} pointerEvents="none" style={[styles.pin, { left: pos(p.t) }, activePin === p.id && styles.pinOn]}>
              <View style={[styles.pinRing, activePin === p.id && { borderColor: Color.white }]}>
                <Avatar k={p.by} size={22} />
              </View>
              <View style={[styles.pinLine, { backgroundColor: person(p.by).color }]} />
            </View>
          ))}
          {ranges.map((r, i) => (
            <View key={`r${i}`} pointerEvents="none" style={[styles.rbar, { left: pos(r.t), width: pos(r.b - r.t) }]} />
          ))}
          {range && w > 0 && (
            <>
              <Animated.View pointerEvents="none" style={[styles.rngbox, boxStyle]} />
              <GestureDetector gesture={dragA}>
                <Animated.View accessibilityLabel="Start of the part" style={[styles.hit, hitA]}>
                  <View style={styles.hnd}>
                    <View style={styles.grip} />
                  </View>
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={dragB}>
                <Animated.View accessibilityLabel="End of the part" style={[styles.hit, hitB]}>
                  <View style={styles.hnd}>
                    <View style={styles.grip} />
                  </View>
                </Animated.View>
              </GestureDetector>
            </>
          )}
          <Animated.View pointerEvents="none" style={[styles.ph, headStyle]} />
        </Animated.View>
      </GestureDetector>
      {/* Tap targets for the pins, on top of everything (44 × 44, centred on the avatar). */}
      {groups.map((g) => (
        <Pressable
          key={g.pins.map((p) => p.id).join('-')}
          accessibilityRole="button"
          accessibilityLabel={g.pins.length > 1 ? `${g.pins.length} notes here` : 'Go to this note'}
          onPress={() => onPin?.(g.pins.map((p) => p.id))}
          style={[styles.pinHit, { left: g.x - HIT / 2 }]}
        />
      ))}
    </View>
  );
}

function Frames({ frames, duration }: { frames: Props['frames']; duration: number }) {
  const [thumbs, setThumbs] = useState<(string | null)[]>([]);
  const url = frames === 'empty' ? null : frames.videoUrl;

  useEffect(() => {
    let live = true;
    if (!url) return;
    (async () => {
      const out: (string | null)[] = [];
      for (let i = 0; i < 8; i++) {
        try {
          const r = await VideoThumbnails.getThumbnailAsync(url, { time: Math.round(((i + 0.5) / 8) * duration * 1000), quality: 0.4 });
          out.push(r.uri);
        } catch {
          out.push(null);
        }
        if (live) setThumbs([...out]);
      }
    })();
    return () => {
      live = false;
    };
  }, [url, duration]);

  return (
    <View style={styles.frames} pointerEvents="none">
      {Array.from({ length: 8 }, (_, i) => {
        if (frames === 'empty') return <View key={i} style={[styles.frame, { backgroundColor: Color.surface }]} />;
        const src = url && thumbs[i] ? { uri: thumbs[i]! } : frames.picture;
        return (
          <View key={i} style={styles.frame}>
            {src && (
              <Image
                source={src}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition={url && thumbs[i] ? 'center' : { left: `${i * 14}%`, top: `${30 + i * 5}%` }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: 56, borderRadius: 6 },
  frames: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 2, borderRadius: 6, overflow: 'hidden' },
  frame: { flex: 1, opacity: 0.85, overflow: 'hidden', backgroundColor: Color.surface },
  pin: { position: 'absolute', top: -24, marginLeft: -11, alignItems: 'center' },
  pinOn: { zIndex: 5 },
  pinRing: { borderRadius: 14, borderWidth: 2, borderColor: 'transparent', margin: -2 },
  // Avatar centre is 13 pt above the strip; the 44 pt target starts at the wrapper's top.
  pinHit: { position: 'absolute', top: 0, width: HIT, height: HIT, zIndex: 6 },
  pinLine: { width: 2, height: 58, marginTop: 2, opacity: 0.9 },
  rbar: { position: 'absolute', bottom: -8, height: 4, borderRadius: 2, backgroundColor: Color.violet },
  rngbox: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    borderWidth: 3,
    borderColor: Color.violet,
    borderRadius: 6,
    backgroundColor: 'rgba(142,108,255,0.22)',
    shadowColor: Color.violet,
    shadowOpacity: 0.6,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 3,
  },
  // 44 × 44 touch area around each 18 × 42 handle.
  hit: {
    position: 'absolute',
    top: (56 - HIT) / 2,
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  hnd: {
    width: 18,
    height: 42,
    borderRadius: 6,
    backgroundColor: Color.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: {
    width: 4,
    height: 16,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: Color.black,
  },
  ph: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: Color.white,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
