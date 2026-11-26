/**
 * Clip upload bar (prototype .cbar):
 *  • uploading: 6 high, violet→blue, white stripes that keep moving (.cbar.up)
 *  • done: 3 high, green, full
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { Color } from '@/constants/brand';

// repeating-linear-gradient(114deg, white .38 0 6px, transparent 6px 14px): one stripe every 15.3 px across.
const PERIOD = 15.33;
const STRIPE = 6.57;
const LEAN = 2.67; // how far a stripe leans over the bar's 6 px height

function Stripes({ width }: { width: number }) {
  const polys = [];
  for (let x = -31; x < width + PERIOD; x += PERIOD) {
    polys.push(`${x},0 ${x + STRIPE},0 ${x + STRIPE - LEAN},6 ${x - LEAN},6`);
  }
  return (
    <Svg width={width + 31} height={6}>
      {polys.map((pts) => (
        <Polygon key={pts} points={pts} fill="rgba(255,255,255,0.38)" transform="translate(31,0)" />
      ))}
    </Svg>
  );
}

export function UploadBar({ percent, uploading }: { percent: number; uploading: boolean }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);

  useEffect(() => {
    if (uploading && !reduced) {
      shift.value = 0;
      shift.value = withRepeat(withTiming(PERIOD, { duration: 600, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(shift);
    }
    return () => cancelAnimation(shift);
  }, [uploading, reduced, shift]);

  const move = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value - 31 }] }));
  const fill = `${Math.max(0, Math.min(100, percent))}%` as const;

  if (!uploading) {
    return (
      <View style={styles.done}>
        <View style={[styles.doneFill, { width: fill }]} />
      </View>
    );
  }

  return (
    <View style={styles.up}>
      <View style={[styles.upFill, { width: fill }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <LinearGradient colors={[Color.violet, Color.blue]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.stripes, move]}>
          <Stripes width={width} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  up: {
    height: 6,
    borderRadius: 4,
    backgroundColor: Color.control,
    marginTop: 6,
    overflow: 'hidden',
  },
  upFill: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  done: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Color.control,
    marginTop: 6,
    overflow: 'hidden',
  },
  doneFill: {
    height: 3,
    backgroundColor: Color.green,
  },
});
