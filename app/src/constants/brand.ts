/**
 * Duoreels design tokens — from CLAUDE.md (Design System V3) and the HTML prototype.
 * Use these instead of writing colours, sizes or fonts by hand.
 */

export const Color = {
  black: '#000000', // stage
  surface: '#1C1C1E', // cards, sheets
  control: '#2C2C30', // chips, secondary buttons
  controlPressed: '#3A3A40',
  disabledText: '#6A6A72', // text on a disabled main button
  surfaceSelected: '#232326', // selected card
  white: '#FFFFFF',
  text2: '#B0B0B8',
  meta: '#8A8A92',
  violet: '#8E6CFF', // brand: main button, selected, links, the creator
  violetDeep: '#6929D4', // brand graphics only (glows, gradients)
  ink: '#100B19', // dark violet background (onboarding)
  green: '#3DE0A0', // done / new
  yellow: '#FFC94D', // waiting
  blue: '#3D8BFF', // first editor
  people: ['#8E6CFF', '#3D8BFF', '#FF9A4D', '#2EC4B6', '#C08BFF'],
} as const;

export const Font = {
  display: 'BigShouldersDisplay_900Black', // caps only
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_500Medium', // time and eyebrows only
} as const;

/**
 * Big Shoulders has tall ascenders: in React Native a lineHeight smaller than the
 * fontSize cuts off the top of the letters. Keep lineHeight ≥ fontSize (+ a little
 * paddingTop) and never put display text in a fixed-height / overflow:hidden box.
 */
export const Type = {
  wordmark: { fontFamily: Font.display, fontSize: 48, lineHeight: 54, paddingTop: 2, letterSpacing: 0.96 },
  mainButton: { fontFamily: Font.display, fontSize: 21, lineHeight: 26, paddingTop: 2, letterSpacing: 0.63 },
  tag: { fontFamily: Font.display, fontSize: 15, lineHeight: 19, paddingTop: 1 },
  title: { fontFamily: Font.bold, fontSize: 28 },
  heading: { fontFamily: Font.bold, fontSize: 20 },
  row: { fontFamily: Font.semibold, fontSize: 16 },
  body: { fontFamily: Font.regular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20 }, // secondary info
  mono: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18 }, // minimum: caps labels + time only
} as const;

export const Space = {
  base: 8,
  screenEdge: 16,
  covers: 8,
  rows: 12,
  groups: 24,
} as const;

export const Radius = {
  card: 16,
  cover: 12,
  input: 12,
  tag: 6,
  pill: 999,
} as const;

export const MinTap = 44;

/** Turns a CSS gradient angle (e.g. 160deg) into expo-linear-gradient start/end points. */
export function cssAngle(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const x = Math.sin(rad) / 2;
  const y = -Math.cos(rad) / 2;
  return { start: { x: 0.5 - x, y: 0.5 - y }, end: { x: 0.5 + x, y: 0.5 + y } };
}
