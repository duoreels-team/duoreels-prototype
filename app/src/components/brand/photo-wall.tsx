import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { cssAngle } from '@/constants/brand';

/**
 * The slanted brand photo wall from the prototype (`mosaic()` + `.mos` CSS).
 * Splash: moving columns. Welcome: still.
 */

// 24 brand frames, ordered so neighbours never repeat (same order as the prototype).
const ORDER = [1, 13, 2, 14, 7, 3, 15, 4, 16, 5, 10, 17, 6, 18, 8, 19, 9, 20, 21, 11, 23, 12, 24, 22];
const PHOTOS: Record<number, number> = {
  1: require('@/assets/brand/b1.jpg'),
  2: require('@/assets/brand/b2.jpg'),
  3: require('@/assets/brand/b3.jpg'),
  4: require('@/assets/brand/b4.jpg'),
  5: require('@/assets/brand/b5.jpg'),
  6: require('@/assets/brand/b6.jpg'),
  7: require('@/assets/brand/b7.jpg'),
  8: require('@/assets/brand/b8.jpg'),
  9: require('@/assets/brand/b9.jpg'),
  10: require('@/assets/brand/b10.jpg'),
  11: require('@/assets/brand/b11.jpg'),
  12: require('@/assets/brand/b12.jpg'),
  13: require('@/assets/brand/b13.jpg'),
  14: require('@/assets/brand/b14.jpg'),
  15: require('@/assets/brand/b15.jpg'),
  16: require('@/assets/brand/b16.jpg'),
  17: require('@/assets/brand/b17.jpg'),
  18: require('@/assets/brand/b18.jpg'),
  19: require('@/assets/brand/b19.jpg'),
  20: require('@/assets/brand/b20.jpg'),
  21: require('@/assets/brand/b21.jpg'),
  22: require('@/assets/brand/b22.jpg'),
  23: require('@/assets/brand/b23.jpg'),
  24: require('@/assets/brand/b24.jpg'),
};
const BRAND = ORDER.map((n) => PHOTOS[n]);

const FX: [string, string][] = [
  ['#8E6CFF', '#6929D4'],
  ['#3D8BFF', '#1F3F9E'],
  ['#6929D4', '#2A1752'],
  ['#3D8BFF', '#8E6CFF'],
];
const GREYS = ['#1C1C1E', '#2C2C30', '#141416'];
const FX_POINTS = cssAngle(160);
const SKEW = 16;

type Panel =
  | { kind: 'photo'; height: number; photo: number; fx?: [string, string]; anim?: 'wash' | 'reveal'; md: number; dl: number }
  | { kind: 'colour'; height: number; fx: [string, string] }
  | { kind: 'grey'; height: number; color: string };

type WallOptions = {
  cols: number;
  rows: number;
  heights: number[];
  seed: number;
  step: number;
  moving: boolean;
  offset?: number;
};

/** Same pseudo-random layout as the prototype, so both look identical. */
function buildColumns(o: WallOptions): Panel[][] {
  let r = o.seed;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  const N = BRAND.length;
  const columns: Panel[][] = [];
  for (let c = 0; c < o.cols; c++) {
    const items: Panel[] = [];
    let n = 0;
    const start = (c * o.step) % N;
    for (let k = 0; k < o.rows; k++) {
      const x = rnd();
      const height = o.heights[Math.floor(rnd() * 4)];
      if (o.moving) {
        const fx = FX[Math.floor(rnd() * 4)];
        const md = 9 + rnd() * 7;
        const dl = -rnd() * 14;
        if (x < 0.75) {
          items.push({ kind: 'photo', height, photo: BRAND[(start + n++) % N], fx, anim: x < 0.55 ? 'wash' : 'reveal', md, dl });
        } else {
          items.push({ kind: 'grey', height, color: GREYS[Math.floor(rnd() * 3)] });
        }
      } else if (x < 0.6) {
        items.push({ kind: 'photo', height, photo: BRAND[(start + n++) % N], md: 0, dl: 0 });
      } else if (x < 0.82) {
        items.push({ kind: 'colour', height, fx: FX[Math.floor(rnd() * 4)] });
      } else {
        items.push({ kind: 'grey', height, color: GREYS[Math.floor(rnd() * 3)] });
      }
    }
    columns.push(items);
  }
  return columns;
}

const SPLASH_LAYOUT = buildColumns({ cols: 5, rows: 8, heights: [112, 136, 160, 186], seed: 11, step: 5, moving: true });
const WELCOME_LAYOUT = buildColumns({ cols: 8, rows: 10, heights: [70, 86, 100, 116], seed: 29, step: 3, moving: false, offset: 28 });

type Variant = 'splash' | 'welcome';

const VARIANT = {
  splash: { columns: SPLASH_LAYOUT, gap: 8, radius: 10, dim: 0.15, offset: 0 },
  welcome: { columns: WELCOME_LAYOUT, gap: 5, radius: 6, dim: 0.2, offset: 28 },
} as const;

const easeInOut = Easing.inOut(Easing.ease);

/** Photo or colour wash, with the prototype's slow "breathe / wash / reveal" loop on the splash. */
function PanelView({ panel, gap, radius, dim, animate }: { panel: Panel; gap: number; radius: number; dim: number; animate: boolean }) {
  const fxOpacity = useSharedValue(panel.kind === 'photo' && panel.anim === 'reveal' ? 0.97 : 0);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    if (!animate || panel.kind !== 'photo' || !panel.anim) return;
    const md = panel.md * 1000;
    // CSS used a negative delay (already part-way through the loop); start at the same point.
    const delay = ((panel.dl * 1000) % md + md) % md;
    const t = (fraction: number) => ({ duration: md * fraction, easing: easeInOut });

    fxOpacity.value =
      panel.anim === 'wash'
        ? withDelay(delay, withRepeat(withSequence(withTiming(0, t(0.64)), withTiming(0.88, t(0.1)), withTiming(0.88, t(0.14)), withTiming(0, t(0.12))), -1))
        : withDelay(delay, withRepeat(withSequence(withTiming(0.97, t(0.58)), withTiming(0, t(0.12)), withTiming(0, t(0.16)), withTiming(0.97, t(0.14))), -1));
    scaleY.value = withDelay(delay, withRepeat(withSequence(withTiming(1, t(0.62)), withTiming(1.07, t(0.14)), withTiming(1, t(0.24))), -1));

    return () => {
      cancelAnimation(fxOpacity);
      cancelAnimation(scaleY);
    };
  }, [animate, panel, fxOpacity, scaleY]);

  const fxStyle = useAnimatedStyle(() => ({ opacity: fxOpacity.value }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: scaleY.value }] }));

  const box: ViewStyle = { height: panel.height, marginBottom: gap, borderRadius: radius, overflow: 'hidden' };

  if (panel.kind === 'grey') {
    return <View style={[box, { backgroundColor: panel.color }]} />;
  }
  if (panel.kind === 'colour') {
    return (
      <View style={box}>
        <LinearGradient colors={panel.fx} {...FX_POINTS} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return (
    <Animated.View style={[box, styles.photoBox, breatheStyle]}>
      <Image source={panel.photo} contentFit="cover" style={styles.photo} transition={0} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
      {panel.fx && (
        <Animated.View style={[StyleSheet.absoluteFill, fxStyle]}>
          <LinearGradient colors={panel.fx} {...FX_POINTS} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** One splash column: the panels twice, scrolling up (odd columns) or down (even columns) forever. */
function MovingColumn({ panels, index, animate, ...panelProps }: { panels: Panel[]; index: number; animate: boolean; gap: number; radius: number; dim: number }) {
  const [half, setHalf] = useState(0);
  const y = useSharedValue(0);
  const goesUp = index % 2 === 0; // CSS :nth-child(odd) = index 0, 2, 4
  const seconds = 36 + (index % 3) * 7;

  useEffect(() => {
    if (!half) return;
    const from = goesUp ? 0 : -half;
    const to = goesUp ? -half : 0;
    y.value = from;
    if (animate) {
      y.value = withRepeat(withTiming(to, { duration: seconds * 1000, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(y);
  }, [half, goesUp, seconds, animate, y]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.column}>
      <Animated.View style={trackStyle} onLayout={(e) => setHalf(e.nativeEvent.layout.height / 2)}>
        {[...panels, ...panels].map((panel, i) => (
          <PanelView key={i} panel={panel} animate={animate} {...panelProps} />
        ))}
      </Animated.View>
    </View>
  );
}

export function PhotoWall({ variant, style }: { variant: Variant; style?: ViewStyle }) {
  const reduceMotion = useReducedMotion();
  const v = VARIANT[variant];
  const panelProps = { gap: v.gap, radius: v.radius, dim: v.dim };

  return (
    <View pointerEvents="none" style={[styles.wall, { gap: v.gap, transform: [{ skewY: `-${SKEW}deg` }] }, style]}>
      {v.columns.map((panels, c) =>
        variant === 'splash' ? (
          <MovingColumn key={c} panels={panels} index={c} animate={!reduceMotion} {...panelProps} />
        ) : (
          <View key={c} style={[styles.column, { marginTop: (c % 2) * -v.offset }]}>
            {panels.map((panel, i) => (
              <PanelView key={i} panel={panel} animate={false} {...panelProps} />
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    position: 'absolute',
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  photoBox: {
    backgroundColor: '#1C1C1E',
  },
  photo: {
    position: 'absolute',
    left: '-10%',
    top: '-14%',
    width: '120%',
    height: '128%',
    transform: [{ skewY: `${SKEW}deg` }],
  },
});
