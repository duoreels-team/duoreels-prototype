import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { LogoMark } from '@/components/brand/logo-mark';
import { PhotoWall } from '@/components/brand/photo-wall';
import { Color, Font } from '@/constants/brand';

const SPLASH_MS = 2400;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

// .splash .mk → mkIn
const markIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -40 }, { translateY: 18 }, { scale: 0.8 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], easing: ease },
}).duration(1100);

// .slide24, 0.35 s later
const wordmarkIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
})
  .duration(550)
  .delay(350);

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/welcome'), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <PhotoWall variant="splash" style={styles.wall} />
      <Vignette />
      <View style={styles.centre}>
        <Animated.View entering={markIn}>
          <LogoMark size={92} />
        </Animated.View>
        <Animated.View entering={wordmarkIn}>
          <Text style={styles.wordmark} accessibilityRole="header">
            DUOREELS
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

/** Darkens the centre so the logo reads (prototype `.splash .vig`). */
function Vignette() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="centre" cx="50%" cy="50%" rx="62%" ry="40%" fx="50%" fy="50%">
          <Stop offset="0" stopColor="#000" stopOpacity={0.92} />
          <Stop offset="0.45" stopColor="#000" stopOpacity={0.72} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </RadialGradient>
        <SvgLinearGradient id="edges" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.35} />
          <Stop offset="0.18" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.82" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#centre)" />
      <Rect width="100%" height="100%" fill="url(#edges)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.black,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wall: {
    left: 8,
    right: 8,
    top: '-18%',
    height: '136%',
  },
  centre: {
    alignItems: 'center',
  },
  wordmark: {
    marginTop: 18,
    fontFamily: Font.display,
    fontSize: 38,
    lineHeight: 42,
    paddingTop: 3,
    letterSpacing: 0.76,
    color: Color.white,
  },
});
