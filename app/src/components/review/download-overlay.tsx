/**
 * "Saving v3 to Photos" (prototype download overlay): ring with %, Cancel,
 * then "Saved to Photos · Ready to post anywhere".
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { downloadVersion, fileName } from '@/lib/download';
import type { Version } from '@/lib/review';

const R = 44;
const C = 2 * Math.PI * R;

export function DownloadOverlay({ version, projectName, onClose, onError }: { version: Version; projectName: string; onClose: () => void; onError: (msg: string) => void }) {
  const [pct, setPct] = useState(0);
  const [saved, setSaved] = useState(false);
  const [task] = useState(() => downloadVersion(version, projectName, setPct));

  useEffect(() => {
    let live = true;
    task.done
      .then(async (r) => {
        if (!live || r === 'cancelled') return;
        setSaved(true);
        await new Promise((res) => setTimeout(res, 1100));
        if (live) onClose();
      })
      .catch((e: Error) => {
        if (!live) return;
        onClose();
        onError(e.message === 'permission' ? 'Allow Photos in Settings to save videos' : e.message.includes('phone') ? e.message : "Couldn't save · check your connection");
      });
    return () => {
      live = false;
    };
  }, [task, onClose, onError]);

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.overlay}>
      <Animated.View entering={ZoomIn.duration(400)} style={styles.card}>
        {saved ? (
          <>
            <View style={styles.check}>
              <Icon name="check" size={30} strokeWidth={2.6} color={Color.black} />
            </View>
            <Text style={styles.title}>Saved to Photos</Text>
            <Text style={styles.meta}>Ready to post anywhere</Text>
          </>
        ) : (
          <>
            <Svg width={96} height={96} viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={R} stroke={Color.control} strokeWidth={6} fill="none" />
              <Circle
                cx={50}
                cy={50}
                r={R}
                stroke={Color.violet}
                strokeWidth={6}
                fill="none"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct / 100)}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <SvgText x={50} y={56} textAnchor="middle" fill={Color.white} fontFamily={Font.semibold} fontSize={18}>
                {`${pct}%`}
              </SvgText>
            </Svg>
            <Text style={styles.title}>Saving v{version.number} to Photos</Text>
            <Text style={styles.mono}>
              {fileName(projectName, version.number, version.media_kind === 'image' ? 'jpg' : 'mp4')} · 1080p
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                task.cancel();
                onClose();
              }}>
              <Text style={[styles.meta, { color: Color.white }]}>Cancel</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: 280,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(28,28,30,0.9)',
  },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Font.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: Color.white,
    textAlign: 'center',
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    textAlign: 'center',
  },
  mono: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Color.meta,
    textAlign: 'center',
  },
});
