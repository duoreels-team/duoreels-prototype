import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Color, Font, MinTap, Space, Type } from '@/constants/brand';

/**
 * Stand-in for a screen that comes later in the build order.
 * Replaced one screen at a time.
 */
export function ComingNext({ title, step, children }: { title: string; step: string; children?: React.ReactNode }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.line}>Comes in {step}.</Text>
      {children}
    </View>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.screenEdge,
    gap: Space.base,
    backgroundColor: Color.black,
  },
  title: {
    ...Type.heading,
    lineHeight: 26,
    color: Color.white,
  },
  line: {
    ...Type.label,
    fontFamily: Font.regular,
    color: Color.meta,
  },
  link: {
    minHeight: MinTap,
    justifyContent: 'center',
  },
  linkText: {
    ...Type.label,
    color: Color.violet,
  },
});
