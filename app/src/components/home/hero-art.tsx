import { useWindowDimensions } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Color } from '@/constants/brand';

/**
 * Home hero (prototype <svg class="heroart"> in V.home), 390 × 270:
 *  1. radial "glow": #8E6CFF .75 → .22 at 45% → 0, centre (.5, .46), r .55
 *  2. diagonal stripes: pattern 26 × 600 rotated 28°, one 11-wide rect at .2
 *  both faded by a mask that is white to 45% and transparent at 100%.
 *
 * Expo Go doesn't draw <Pattern patternTransform> / <Mask> reliably, so the stripes
 * are real rects in a rotated group clipped to the box, and the fade is a black
 * gradient on top (the page behind is black, so it looks the same as the mask).
 * It sits at the top of the Home ScrollView and scrolls away with it.
 */
const W = 390;
const H = 270;
const PERIOD = 26;
const STRIPE = 11;

// Rects in the rotated (28°) space that cover the whole 390 × 270 box.
const STRIPES = Array.from({ length: 32 }, (_, i) => (i - 12) * PERIOD);

export function HeroArt() {
  const { width } = useWindowDimensions();
  const height = (H * width) / W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="0.5" cy="0.46" r="0.55">
          <Stop offset="0" stopColor={Color.violet} stopOpacity={0.75} />
          <Stop offset="0.45" stopColor={Color.violet} stopOpacity={0.22} />
          <Stop offset="1" stopColor={Color.violet} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor={Color.black} stopOpacity={0} />
          <Stop offset="1" stopColor={Color.black} stopOpacity={1} />
        </LinearGradient>
        <ClipPath id="box">
          <Rect x={0} y={0} width={W} height={H} />
        </ClipPath>
      </Defs>
      <Rect width={W} height={H} fill="url(#glow)" />
      <G clipPath="url(#box)">
        <G transform="rotate(28)">
          {STRIPES.map((x) => (
            <Rect key={x} x={x} y={-900} width={STRIPE} height={1800} fill={Color.violet} fillOpacity={0.2} />
          ))}
        </G>
      </G>
      <Rect width={W} height={H} fill="url(#fade)" />
    </Svg>
  );
}
