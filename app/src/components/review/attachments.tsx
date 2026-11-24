/**
 * What a note can carry: a picture (tap → full screen), a link (tap → opens it),
 * a voice clip (play / pause) — plus the bar shown while you record.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { fmt } from '@/lib/review';
import { useSignedUrl } from '@/lib/storage';

/** "dribbble.com/x" → "https://dribbble.com/x"; null if it isn't a web link. */
export function normaliseLink(input: string) {
  const v = input.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || u.hostname.endsWith('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.length > 1 ? u.pathname : ''}`;
  } catch {
    return url;
  }
}

function RemoveDot({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.remove}>
      <Icon name="close" size={12} strokeWidth={2.4} color={Color.black} />
    </Pressable>
  );
}

/* ---------- picture ---------- */

export function AttachedImage({ uri, path, size = 56, onRemove }: { uri?: string | null; path?: string | null; size?: number; onRemove?: () => void }) {
  const signed = useSignedUrl(uri ? null : path);
  const src = uri ?? signed;
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open picture" onPress={() => src && setOpen(true)} style={[styles.thumb, { width: size, height: size }]}>
        {src && <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      </Pressable>
      {onRemove && <RemoveDot label="Remove picture" onPress={onRemove} />}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.viewer}>
          {src && <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="contain" />}
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={[styles.viewerClose, { top: insets.top + 8 }]}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- link ---------- */

export function LinkChip({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <View style={styles.chipRow}>
      <Chip height={30} accessibilityLabel={`Open ${url}`} onPress={() => WebBrowser.openBrowserAsync(url)} style={styles.chip}>
        <Icon name="link" size={14} color={Color.violet} />
        <Text style={styles.chipText} numberOfLines={1}>
          {hostOf(url)}
        </Text>
      </Chip>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel="Remove link" onPress={onRemove} hitSlop={10} style={styles.chipX}>
          <Icon name="close" size={14} color={Color.text2} />
        </Pressable>
      )}
    </View>
  );
}

/* ---------- voice clip ---------- */

export function AudioChip({ uri, path, seconds, onRemove }: { uri?: string | null; path?: string | null; seconds?: number; onRemove?: () => void }) {
  const signed = useSignedUrl(uri ? null : path);
  const src = uri ?? signed;
  const player = useAudioPlayer(src ? { uri: src } : null);
  const status = useAudioPlayerStatus(player);
  const total = status.duration || seconds || 0;
  return (
    <View style={styles.chipRow}>
      <Chip
        height={30}
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        onPress={() => {
          if (!src) return;
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish || (total && status.currentTime >= total - 0.1)) player.seekTo(0);
            player.play();
          }
        }}
        style={styles.chip}>
        <Icon name={status.playing ? 'pause' : 'play'} size={14} color={Color.violet} />
        <Icon name="mic" size={14} color={Color.text2} />
        <Text style={styles.chipMono}>{status.playing ? fmt(status.currentTime) : fmt(total)}</Text>
      </Chip>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel="Remove voice note" onPress={onRemove} hitSlop={10} style={styles.chipX}>
          <Icon name="close" size={14} color={Color.text2} />
        </Pressable>
      )}
    </View>
  );
}

/* ---------- while recording ---------- */

function Bar({ delay }: { delay: number }) {
  const h = useSharedValue(4);
  useEffect(() => {
    h.value = withDelay(delay, withRepeat(withSequence(withTiming(20, { duration: 450 }), withTiming(4, { duration: 450 })), -1));
  }, [delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

export function RecordingBar({ seconds, onStop }: { seconds: number; onStop: () => void }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.35, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.rec}>
      <Animated.View style={[styles.recDot, dot]} />
      <Text style={styles.chipMono}>{fmt(seconds)}</Text>
      <View style={styles.wave}>
        {Array.from({ length: 16 }, (_, i) => (
          <Bar key={i} delay={(i * 67) % 450} />
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={onStop} style={styles.stop}>
        <View style={styles.stopSquare} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
    backgroundColor: Color.black,
  },
  viewerClose: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chip: { flexShrink: 1 },
  chipText: {
    flexShrink: 1,
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  chipMono: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Color.text2,
  },
  chipX: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 22,
    backgroundColor: Color.control,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Color.violet,
  },
  wave: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Color.white,
  },
  stop: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Color.black,
  },
});
