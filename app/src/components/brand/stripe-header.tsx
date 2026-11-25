/**
 * The one stripe header (prototype .hstripes) used on Projects, the editor home
 * and Marketplace: violet stripes 16 pt wide with a 20 pt gap, leaning top-left to
 * bottom-right 24° from vertical (CSS repeating-linear-gradient(66deg …)),
 * 10% opacity at the top → 34% in the middle → 0 at the bottom, 250 pt high.
 * It sits behind the content at the top of the ScrollView and scrolls away with it.
 *
 * Drawn as parallelograms with one vertical gradient fill (no SVG mask, which
 * Expo Go doesn't draw reliably).
 */
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import { Color } from '@/constants/brand';

export const STRIPE_HEIGHT = 250;
const LEAN = (24 * Math.PI) / 180; // from vertical
const WIDTH = 16 / Math.cos(LEAN); // 16 pt measured across the stripe
const PERIOD = 36 / Math.cos(LEAN); // 16 stripe + 20 gap, across

export function StripeHeader({ height = STRIPE_HEIGHT }: { height?: number }) {
  const { width } = useWindowDimensions();
  const shift = height * Math.tan(LEAN); // how far a stripe moves right from top to bottom
  const stripes: string[] = [];
  for (let x = -shift - PERIOD; x < width + PERIOD; x += PERIOD) {
    stripes.push(`${x.toFixed(1)},0 ${(x + WIDTH).toFixed(1)},0 ${(x + WIDTH + shift).toFixed(1)},${height} ${(x + shift).toFixed(1)},${height}`);
  }
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="stripeFade" x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={Color.violet} stopOpacity={0.1} />
          <Stop offset="0.5" stopColor={Color.violet} stopOpacity={0.34} />
          <Stop offset="1" stopColor={Color.violet} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {stripes.map((pts) => (
        <Polygon key={pts} points={pts} fill="url(#stripeFade)" />
      ))}
    </Svg>
  );
}
