import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';

/** Projects · Marketplace · Me — glass bar, filled icon on the selected tab (prototype drawTabs). */
const TABS: Record<string, { icon: IconName; iconOn: IconName; label: string }> = {
  index: { icon: 'projects', iconOn: 'projects-filled', label: 'Projects' },
  market: { icon: 'market', iconOn: 'market-filled', label: 'Marketplace' },
  me: { icon: 'me', iconOn: 'me-filled', label: 'Me' },
};

export const TAB_BAR_HEIGHT = 84;

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { height: Math.max(TAB_BAR_HEIGHT, 50 + insets.bottom) }]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const on = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (!on) navigateToTab(route.key);
            }}
            style={styles.tab}>
            <Icon name={on ? tab.iconOn : tab.icon} size={26} strokeWidth={1.6} color={on ? Color.white : Color.meta} />
            <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tint: {
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  tab: {
    width: 96,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
  },
  labelOn: {
    color: Color.white,
  },
});
