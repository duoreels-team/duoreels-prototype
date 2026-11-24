import { useWindowDimensions } from 'react-native';
import Svg, { Defs, G, LinearGradient, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Home hero (prototype .heroart): one violet light + diagonal stripes,
 * fading out towards the bottom. Sits behind "+ New project" and scrolls with it.
 */
export function HeroArt() {
  const { width } = useWindowDimensions();
  const height = (270 * width) / 390;
  return (
    <Svg width={width} height={height} viewBox="0 0 390 270" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="hf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor="#fff" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
        <Pattern id="hstr" patternUnits="userSpaceOnUse" width="26" height="600" patternTransform="rotate(28)">
          <Rect width="11" height="600" fill="#8E6CFF" fillOpacity="0.2" />
        </Pattern>
        <Mask id="hm" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="270">
          <Rect width="390" height="270" fill="url(#hf)" />
        </Mask>
        <RadialGradient id="glow" cx="0.5" cy="0.46" r="0.55">
          <Stop offset="0" stopColor="#8E6CFF" stopOpacity="0.75" />
          <Stop offset="0.45" stopColor="#8E6CFF" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#8E6CFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G mask="url(#hm)">
        <Rect width="390" height="270" fill="url(#glow)" />
        <Rect width="390" height="270" fill="url(#hstr)" />
      </G>
    </Svg>
  );
}
