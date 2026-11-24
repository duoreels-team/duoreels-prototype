/**
 * Bottom sheet + toast, like the prototype's #sheet-host and #toast-host.
 * They sit above every screen (and the tab bar).
 */
import { BlurView } from 'expo-blur';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

type Toast = { id: number; text: string; undo?: () => void; icon: boolean };

type OverlayValue = {
  openSheet: (content: ReactNode) => void;
  closeSheet: () => void;
  toast: (text: string, undo?: () => void, icon?: boolean) => void;
};

const OverlayContext = createContext<OverlayValue | null>(null);

export function useOverlay() {
  const value = useContext(OverlayContext);
  if (!value) throw new Error('useOverlay must be used inside <OverlayProvider>');
  return value;
}

export function OverlayProvider({ children }: PropsWithChildren) {
  const [sheet, setSheet] = useState<ReactNode>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastItem, setToastItem] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSheet = useCallback((content: ReactNode) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSheet(content);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSheet(null), 450);
  }, []);

  const toast = useCallback((text: string, undo?: () => void, icon = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastItem({ id: Date.now(), text, undo, icon });
    toastTimer.current = setTimeout(() => setToastItem(null), 2800 + 360);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [sheetOpen, closeSheet]);

  const value = useMemo(() => ({ openSheet, closeSheet, toast }), [openSheet, closeSheet, toast]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <SheetHost open={sheetOpen} onClose={closeSheet}>
        {sheet}
      </SheetHost>
      {toastItem && (
        <ToastView
          key={toastItem.id}
          item={toastItem}
          onUndo={() => {
            toastItem.undo?.();
            setToastItem(null);
          }}
        />
      )}
    </OverlayContext.Provider>
  );
}

function SheetHost({ open, onClose, children }: PropsWithChildren<{ open: boolean; onClose: () => void }>) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: open ? 450 : 350, easing: ease });
  }, [open, progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * (height + 40) }] }));

  if (!children) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={[styles.sheet, { paddingBottom: Math.max(30, insets.bottom + 8), maxHeight: '88%' }, panel]}>
        <View style={styles.grab} />
        <ScrollView style={styles.sbody} contentContainerStyle={styles.sbodyContent} bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const toastIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -30 }, { translateY: 14 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
}).duration(500);

const toastOut = new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateX: 30 }, { translateY: -13 }] },
}).duration(350);

function ToastView({ item, onUndo }: { item: Toast; onUndo: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOut(true), 2800);
    return () => clearTimeout(t);
  }, []);
  if (out) return null;
  return (
    <View style={styles.toastHost} pointerEvents="box-none">
      <Animated.View entering={toastIn} exiting={toastOut} style={styles.toast} accessibilityLiveRegion="polite">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        {item.icon && (
          <View style={styles.check}>
            <Icon name="check" size={14} strokeWidth={2.6} color={Color.black} />
          </View>
        )}
        <Text style={styles.toastText}>{item.text}</Text>
        {item.undo && (
          <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12}>
            <Text style={styles.undo}>Undo</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

/** A plain fade for content that appears inside a sheet. */
export const sheetFade = FadeIn.duration(200);

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Color.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  grab: {
    width: 38,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#48484F',
    marginTop: 9,
    marginBottom: 4,
    alignSelf: 'center',
  },
  sbody: {
    flexGrow: 0,
  },
  sbodyContent: {
    paddingTop: 6,
    paddingHorizontal: 16,
  },
  toastHost: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(28,28,30,0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
    flexShrink: 1,
  },
  undo: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Color.violet,
  },
});
