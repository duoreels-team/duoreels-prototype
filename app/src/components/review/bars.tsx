/**
 * Review screen bars (prototype drawBottom): the decision bar (#decide), the
 * voice bar, and the tool bar (Voice · Text · Draw · Range · Cover · Notes)
 * or the draw tools (Pen · Arrow · Circle · Undo).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { Avatar } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
export const barIn = FadeInDown.duration(250).easing(ease).withInitialValues({ opacity: 0, transform: [{ translateY: 20 }] });

/* ---------- decision bar (dbar) ---------- */

export function DecisionBar({
  who,
  icon,
  title,
  sub,
  children,
  onHide,
}: {
  who?: string;
  icon?: IconName;
  title: ReactNode;
  sub: ReactNode;
  children?: ReactNode;
  onHide?: () => void;
}) {
  return (
    <Animated.View entering={barIn} style={styles.dbar}>
      {who ? (
        <Avatar k={who} size={32} />
      ) : icon ? (
        <View style={styles.dav}>
          <Icon name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.dTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.dMeta} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {children}
      {onHide && (
        <Pressable accessibilityRole="button" accessibilityLabel="Hide" onPress={onHide} hitSlop={10} style={styles.dx}>
          <Icon name="close" size={20} color="#8A8A90" />
        </Pressable>
      )}
    </Animated.View>
  );
}

export function DButton({ label, onPress, tone = 'violet', icon }: { label: string; onPress: () => void; tone?: 'violet' | 'control'; icon?: IconName }) {
  const violet = tone === 'violet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.dbtn, { backgroundColor: violet ? Color.violet : Color.control }, pressed && { transform: [{ scale: 0.97 }] }]}>
      {icon && <Icon name={icon} size={16} color={violet ? Color.black : Color.white} />}
      <Text style={[styles.dbtnText, { color: violet ? Color.black : Color.white }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

/* ---------- voice bar (.voicebar.f) ---------- */

function WaveBar({ delay }: { delay: number }) {
  const h = useSharedValue(5);
  useEffect(() => {
    h.value = withDelay(delay, withRepeat(withSequence(withTiming(26, { duration: 500 }), withTiming(5, { duration: 500 })), -1));
  }, [delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

export function VoiceBar({ editorName, seconds, onDone }: { editorName: string; seconds: number; onDone: () => void }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ shadowRadius: 1 + pulse.value * 8, shadowOpacity: 0.18 + pulse.value * 0.2 }));
  const m = Math.floor(seconds / 60);
  return (
    <Animated.View entering={barIn} style={styles.voicebar}>
      <LinearGradient colors={['rgba(142,108,255,0.35)', 'rgba(61,139,255,0.35)']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.vmic, ring]}>
        <Icon name="mic" size={20} color={Color.black} />
      </Animated.View>
      <View style={{ gap: 2 }}>
        <Text style={styles.dTitle}>Talking to {editorName}</Text>
        <Text style={styles.mono}>
          Listening · {m}:{String(seconds % 60).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.wave}>
        {Array.from({ length: 14 }, (_, i) => (
          <WaveBar key={i} delay={(i * 73) % 600} />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }) => [styles.card, pressed && { backgroundColor: Color.white }]}>
        {({ pressed }) => <Text style={[styles.cardText, pressed && { color: Color.black }]}>DONE</Text>}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- tool bar ---------- */

export type ToolKey = 'voice' | 'text' | 'draw' | 'range' | 'cover';
const TOOLS: [IconName, string, ToolKey][] = [
  ['mic', 'Voice', 'voice'],
  ['chat', 'Text', 'text'],
  ['pen', 'Draw', 'draw'],
  ['range', 'Range', 'range'],
  ['cover', 'Cover', 'cover'],
];

export function ToolBar({ enabled, voiceOn, notes, onTool, onNotes }: { enabled: (k: ToolKey) => boolean; voiceOn: boolean; notes: number; onTool: (k: ToolKey) => void; onNotes: () => void }) {
  return (
    <View style={styles.tools}>
      {TOOLS.map(([icon, label, key]) => {
        const on = voiceOn && key === 'voice';
        const ok = enabled(key);
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !ok }}
            disabled={!ok}
            onPress={() => onTool(key)}
            style={({ pressed }) => [styles.tl, (pressed || on) && styles.tlOn, !ok && { opacity: 0.3 }]}>
            <Icon name={icon} size={24} strokeWidth={1.6} color={on ? Color.violet : '#DDDDDD'} />
            <Text style={[styles.tlText, on && { color: Color.violet }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel={`Notes, ${notes}`} onPress={onNotes} style={({ pressed }) => [styles.notesbtn, pressed && { backgroundColor: Color.controlPressed }]}>
        <Text style={styles.notesText}>NOTES</Text>
        {notes > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notes}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

type DrawKey = 'pen' | 'line' | 'circle' | 'check';

export function DrawToolBar({ tool, onTool, onUndo }: { tool: DrawKey; onTool: (t: DrawKey) => void; onUndo: () => void }) {
  const items: [DrawKey, string][] = [
    ['pen', 'Pen'],
    ['line', 'Arrow'],
    ['circle', 'Circle'],
    ['check', 'Tick'],
  ];
  return (
    <View style={styles.tools}>
      {items.map(([k, label]) => {
        const on = tool === k;
        const c = on ? Color.violet : '#DDDDDD';
        return (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => onTool(k)} style={[styles.tl, on && styles.tlOn]}>
            {k === 'pen' ? (
              <Icon name="pen" size={24} strokeWidth={1.6} color={c} />
            ) : k === 'check' ? (
              <Icon name="check" size={24} strokeWidth={1.6} color={c} />
            ) : (
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round">
                {k === 'circle' ? <Ellipse cx={12} cy={12} rx={8} ry={6.5} /> : <Path d="M5 19 19 5M11 5h8v8" />}
              </Svg>
            )}
            <Text style={[styles.tlText, on && { color: Color.violet }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={onUndo} style={({ pressed }) => [styles.tl, pressed && styles.tlOn]}>
        <Icon name="undo" size={24} strokeWidth={1.6} color="#DDDDDD" />
        <Text style={styles.tlText}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  dbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  dav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dTitle: {
    fontFamily: Font.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: Color.white,
  },
  dMeta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
    marginTop: 3,
  },
  dx: {
    width: 24,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -2,
    marginRight: -4,
  },
  dbtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dbtnText: {
    fontFamily: Font.display,
    fontSize: 20,
    lineHeight: 25,
    paddingTop: 2,
    letterSpacing: 0.6,
  },
  voicebar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  vmic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Color.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Color.white,
    shadowOffset: { width: 0, height: 0 },
  },
  mono: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Color.text2,
  },
  wave: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Color.white,
  },
  card: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.white,
    justifyContent: 'center',
  },
  cardText: {
    fontFamily: Font.display,
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 2,
    letterSpacing: 0.5,
    color: Color.white,
  },
  // Fits any phone width: the tools share what's left, Notes keeps its own width.
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    paddingLeft: 10,
    paddingRight: 16,
  },
  tl: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tlOn: {
    backgroundColor: Color.surface,
  },
  tlText: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: '#DDDDDD',
  },
  notesbtn: {
    flexShrink: 0,
    marginLeft: 4,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Color.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notesText: {
    fontFamily: Font.display,
    fontSize: 18,
    lineHeight: 23,
    paddingTop: 2,
    letterSpacing: 0.54,
    color: Color.white,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: Color.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.black,
  },
});
