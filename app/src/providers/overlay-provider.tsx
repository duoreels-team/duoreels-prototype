/**
 * Bottom sheet + toast, like the prototype's #sheet-host and #toast-host.
 * They sit above every screen (and the tab bar).
 */
import { BlurView } from 'expo-blur';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, type HostInstance, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

type Toast = { id: number; text: string; undo?: () => void; icon: boolean; ms: number };

type OverlayValue = {
  openSheet: (content: ReactNode) => void;
  closeSheet: () => void;
  /** ms: how long it stays (default 2.8 s; 5 s for a delete you can undo). */
  toast: (text: string, undo?: () => void, icon?: boolean, ms?: number) => void;
  /** Top banner (prototype #banner): slides down, tap it to open what it's about. */
  banner: (content: ReactNode, onTap: () => void) => void;
  /** Scroll the open sheet so this row sits near its top. */
  scrollSheetTo: (target: HostInstance | null) => void;
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
  const [bannerItem, setBannerItem] = useState<{ id: number; content: ReactNode; onTap: () => void } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetScroll = useRef<ScrollViewInstance>(null);
  const sheetOffset = useRef(0);

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

  const toast = useCallback((text: string, undo?: () => void, icon = true, ms = 2800) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastItem({ id: Date.now(), text, undo, icon, ms });
    toastTimer.current = setTimeout(() => setToastItem(null), ms + 360);
  }, []);

  const banner = useCallback((content: ReactNode, onTap: () => void) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBannerItem({ id: Date.now(), content, onTap });
    bannerTimer.current = setTimeout(() => setBannerItem(null), 4200);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [sheetOpen, closeSheet]);

  const scrollSheetTo = useCallback((target: HostInstance | null) => {
    const sv = sheetScroll.current;
    if (!target || !sv) return;
    // Both are inside the sliding panel, so the gap between them is right even mid-slide.
    target.measureInWindow((_x, y) => {
      sv.measureInWindow((_sx, sy) => {
        sv.scrollTo({ y: Math.max(0, sheetOffset.current + y - sy - 24), animated: true });
      });
    });
  }, []);

  const value = useMemo(() => ({ openSheet, closeSheet, toast, banner, scrollSheetTo }), [openSheet, closeSheet, toast, banner, scrollSheetTo]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <SheetHost open={sheetOpen} onClose={closeSheet} scrollRef={sheetScroll} onOffset={(y) => (sheetOffset.current = y)}>
        {sheet}
      </SheetHost>
      {bannerItem && (
        <BannerView
          key={bannerItem.id}
          onTap={() => {
            setBannerItem(null);
            bannerItem.onTap();
          }}>
          {bannerItem.content}
        </BannerView>
      )}
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

function SheetHost({
  open,
  onClose,
  scrollRef,
  onOffset,
  children,
}: PropsWithChildren<{ open: boolean; onClose: () => void; scrollRef: RefObject<ScrollViewInstance | null>; onOffset: (y: number) => void }>) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();
  const [height, setHeight] = useState(600);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: open ? 450 : 350, easing: ease });
  }, [open, progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  // Slides up from the bottom, and sits on top of the keyboard when one is open.
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * (height + 40) - keyboard.height.value }] }));

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
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => onOffset(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          style={styles.sbody}
          contentContainerStyle={styles.sbodyContent}
          bounces={false}
          keyboardShouldPersistTaps="handled">
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
    const t = setTimeout(() => setOut(true), item.ms);
    return () => clearTimeout(t);
  }, [item.ms]);
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

const bannerIn = new Keyframe({
  0: { transform: [{ translateY: -220 }] },
  100: { transform: [{ translateY: 0 }], easing: ease },
}).duration(500);
const bannerOut = new Keyframe({
  0: { transform: [{ translateY: 0 }] },
  100: { transform: [{ translateY: -220 }], easing: ease },
}).duration(500);

function BannerView({ children, onTap }: PropsWithChildren<{ onTap: () => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={bannerIn} exiting={bannerOut} style={[styles.bannerHost, { top: insets.top + 3 }]}>
      <Pressable accessibilityRole="button" onPress={onTap} style={styles.banner}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        {children}
      </Pressable>
    </Animated.View>
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
  bannerHost: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 85,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(36,36,40,0.78)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
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
