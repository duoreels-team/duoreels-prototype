/**
 * The timeline strip under the video (prototype .strip): 8 frames, pins,
 * range bars, the range box with two handles, and the white playhead.
 *
 * Scrubbing and the range handles run on the UI thread (gesture-handler +
 * reanimated), so dragging stays smooth and the time label updates live.
 * Handles can't cross, the range is at least 1 s and stays inside the video.
 */
import { Image, type ImageSource } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar } from '@/components/brand/bits';
import { Color } from '@/constants/brand';
import { person } from '@/lib/people';

export type Pin = { t: number; by: string };
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
  /** True while a finger is on the strip (the screen turns off swipe-back). */
  onTouch?: (active: boolean) => void;
  style?: object;
};

const HIT = 44;

export function Strip({ duration, t, frames, pins, ranges, range, onSeek, onRange, onTouch, style }: Props) {
  const [w, setW] = useState(0);
  const width = useSharedValue(0);
  const dur = useSharedValue(duration || 1);
  const head = useSharedValue(t);
  const scrubbing = useSharedValue(0);
  const a = useSharedValue(range?.a ?? 0);
  const b = useSharedValue(range?.b ?? 1);
  const handleDrag = useSharedValue(0);
  const start = useSharedValue(0);

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
  const touchJS = (on: boolean) => onTouch?.(on);

  /* scrub: tap or drag anywhere on the strip (off while the range box is up) */
  const scrub = usePanGesture({
    enabled: !range,
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scrubbing.set(1);
      const time = Math.min(1, Math.max(0, e.x / (width.get() || 1))) * dur.get();
      head.set(time);
      scheduleOnRN(touchJS, true);
      scheduleOnRN(seekJS, time);
    },
    onUpdate: (e) => {
      'worklet';
      const time = Math.min(1, Math.max(0, e.x / (width.get() || 1))) * dur.get();
      head.set(time);
      scheduleOnRN(seekJS, time);
    },
    onFinalize: () => {
      'worklet';
      scrubbing.set(0);
      scheduleOnRN(touchJS, false);
    },
  });

  /* left handle */
  const dragA = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      handleDrag.set(1);
      start.set(a.get());
      scheduleOnRN(touchJS, true);
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
      scheduleOnRN(touchJS, false);
    },
  });

  /* right handle */
  const dragB = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      'worklet';
      handleDrag.set(1);
      start.set(b.get());
      scheduleOnRN(touchJS, true);
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
      scheduleOnRN(touchJS, false);
    },
  });

  const headStyle = useAnimatedStyle(() => ({ left: (head.get() / dur.get()) * width.get() }));
  const boxStyle = useAnimatedStyle(() => ({ left: (a.get() / dur.get()) * width.get(), width: ((b.get() - a.get()) / dur.get()) * width.get() }));
  const hitA = useAnimatedStyle(() => ({ left: (a.get() / dur.get()) * width.get() - HIT / 2 - 2 }));
  const hitB = useAnimatedStyle(() => ({ left: (b.get() / dur.get()) * width.get() - HIT / 2 + 2 }));

  const pos = (time: number) => `${Math.min(100, Math.max(0, (time / (duration || 1)) * 100))}%` as const;

  return (
    <GestureDetector gesture={scrub}>
      <Animated.View
        style={[styles.strip, style]}
        onLayout={(e: LayoutChangeEvent) => {
          setW(e.nativeEvent.layout.width);
          width.set(e.nativeEvent.layout.width);
        }}>
        <Frames frames={frames} duration={duration} />
        {pins.map((p, i) => (
          <View key={`${p.t}-${p.by}-${i}`} pointerEvents="none" style={[styles.pin, { left: pos(p.t) }]}>
            <Avatar k={p.by} size={22} />
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
  strip: {
    height: 56,
    borderRadius: 6,
  },
  frames: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  frame: {
    flex: 1,
    opacity: 0.85,
    overflow: 'hidden',
    backgroundColor: Color.surface,
  },
  pin: {
    position: 'absolute',
    top: -24,
    marginLeft: -11,
    alignItems: 'center',
  },
  pinLine: {
    width: 2,
    height: 58,
    marginTop: 2,
    opacity: 0.9,
  },
  rbar: {
    position: 'absolute',
    bottom: -8,
    height: 4,
    borderRadius: 2,
    backgroundColor: Color.violet,
  },
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
