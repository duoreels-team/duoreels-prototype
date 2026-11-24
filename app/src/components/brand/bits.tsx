/**
 * Small pieces the prototype reuses everywhere: tags, avatars, covers,
 * the slanted main button, section headers and list rows.
 */
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { person } from '@/lib/people';
import { coverSource, mmss, type Project, type TagTone } from '@/lib/projects';

/* ---------- slanted shape (clip-path: polygon(s 0, 100% 0, calc(100% - s) 100%, 0 100%)) ---------- */

function SlantFill({ width, height, slant, color }: { width: number; height: number; slant: number; color: string }) {
  if (!width) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polygon points={`${slant},0 ${width},0 ${width - slant},${height} 0,${height}`} fill={color} />
    </Svg>
  );
}

/* ---------- tag: Big Shoulders caps on a slanted chip ---------- */

const TAG_BG: Record<TagTone, string> = { violet: Color.violet, yellow: Color.yellow, grey: Color.control };

export function Tag({ label, tone, height = 20, style }: { label: string; tone: TagTone; height?: number; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[styles.tag, { height }, style]}>
      <SlantFill width={w} height={height} slant={9} color={TAG_BG[tone]} />
      <Text style={[styles.tagText, tone === 'grey' && { color: Color.white }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/* ---------- avatar: coloured circle with the initial ---------- */

export function Avatar({ k, size = 24 }: { k: string; size?: number }) {
  const p = person(k);
  return (
    <View style={[styles.avatar, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      <View style={[styles.avatarFill, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.color }]}>
        {/* 13 is our smallest size, so the letter never goes below it. */}
        <Text style={[styles.avatarText, { fontSize: Math.max(13, Math.round(size * 0.45)) }]}>{k}</Text>
      </View>
    </View>
  );
}

export function AvatarStack({ keys, size = 24 }: { keys: string[]; size?: number }) {
  return (
    <View style={styles.avatarStack}>
      {keys.map((k, i) => (
        <View key={k + i} style={i > 0 && { marginLeft: -7 }}>
          <Avatar k={k} size={size} />
        </View>
      ))}
    </View>
  );
}

/* ---------- 3:4 cover with the time in the corner (.cv34) ---------- */

export function Cover34({ project, width, radius = 8, showTime = true }: { project: Project; width: number; radius?: number; showTime?: boolean }) {
  const source = coverSource(project);
  return (
    <View style={[styles.cover, { width, height: (width * 4) / 3, borderRadius: radius }]}>
      {source && <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
      {showTime && (
        <View style={styles.cut}>
          <Text style={styles.cutText}>{mmss(project.duration_seconds)}</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- slanted main button (Home "+ New project") ---------- */

export function SlantButton({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  const [w, setW] = useState(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.slantButton, pressed && { transform: [{ translateY: 1 }] }]}>
      {({ pressed }) => (
        <>
          <SlantFill width={w} height={48} slant={22} color={pressed ? Color.violetDeep : Color.violet} />
          {icon && <Icon name={icon} size={20} strokeWidth={2.6} color={pressed ? Color.white : Color.black} />}
          <Text style={[styles.slantText, pressed && { color: Color.white }]}>{label.toUpperCase()}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ---------- section header: "IN PROGRESS · 7      See all ›" ---------- */

export function Section({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sec, style]}>
      <Text style={styles.secText}>{title.toUpperCase()}</Text>
      {action && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <Text style={styles.secAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ---------- icon button (.ib: 40×40) ---------- */

export function IconButton({
  name,
  label,
  onPress,
  size = 24,
  color = Color.white,
  width = 40,
  style,
  children,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  width?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 2, bottom: 2, left: (44 - width) / 2 + 2, right: (44 - width) / 2 + 2 }}
      style={({ pressed }) => [styles.ib, { width }, pressed && { backgroundColor: Color.surface }, style]}>
      <Icon name={name} size={size} color={color} />
      {children}
    </Pressable>
  );
}

/* ---------- toggle (.toggle) ---------- */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      hitSlop={8}
      style={[styles.toggle, on && { backgroundColor: Color.violet }]}>
      <View style={[styles.knob, on && { transform: [{ translateX: 18 }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tagText: {
    fontFamily: Font.display,
    fontSize: 14,
    lineHeight: 18,
    paddingTop: 1,
    letterSpacing: 0.56,
    color: Color.black,
  },
  // The black ring (box-shadow 0 0 0 2px #000) sits outside the avatar without taking space.
  avatar: {
    margin: -2,
    backgroundColor: Color.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Font.bold,
    color: Color.black,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  cover: {
    overflow: 'hidden',
    backgroundColor: Color.surface,
  },
  cut: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  cutText: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 16,
    color: Color.white,
  },
  slantButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  slantText: {
    fontFamily: Font.display,
    fontSize: 20,
    lineHeight: 25,
    paddingTop: 2,
    letterSpacing: 0.6,
    color: Color.black,
  },
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  secText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    color: Color.meta,
  },
  secAction: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
  ib: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3A3A42',
    padding: 3,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Color.white,
  },
});
