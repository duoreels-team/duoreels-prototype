import { router } from 'expo-router';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Color, Font, MinTap, Radius, Space, Type } from '@/constants/brand';

/* ---------- icons (prototype ICO set: 24×24, stroke 1.8, round) ---------- */

const ICONS = {
  back: <Path d="m15 5-7 7 7 7" />,
  camera: (
    <>
      <Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
      <Circle cx={12} cy={13} r={3.5} />
    </>
  ),
  video: (
    <>
      <Rect x={3} y={6.5} width={13} height={11} rx={2} />
      <Path d="m16 10.5 5-3v9l-5-3" />
    </>
  ),
  pen: (
    <>
      <Path d="M4 20h4L19 9l-4-4L4 16z" />
      <Path d="m13.5 6.5 4 4" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = Color.white, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}

/* ---------- top bar with back chevron (.topbar + .ib) ---------- */

export function TopBar({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.topbar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={4}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
        <Icon name="back" />
      </Pressable>
    </View>
  );
}

/* ---------- screen title (Geist Bold 28) ---------- */

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

/* ---------- field label: Geist Mono caps, grey ---------- */

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children.toUpperCase()}</Text>;
}

/* ---------- dark input: Surface, radius 12, 50 high, violet border when focused ---------- */

export const TextField = forwardRef<TextInputInstance, TextInputProps>(function TextField({ style, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={Color.meta}
      selectionColor={Color.violet}
      keyboardAppearance="dark"
      {...props}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, style]}
    />
  );
});

/* ---------- main button: violet pill, Big Shoulders caps, 52 high ---------- */

export function MainButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mainButton,
        disabled && styles.mainButtonDisabled,
        pressed && styles.mainButtonPressed,
        style,
      ]}>
      {({ pressed }) =>
        loading ? (
          <ActivityIndicator color={disabled ? Color.disabledText : Color.black} />
        ) : (
          <Text style={[styles.mainButtonText, disabled && styles.mainButtonTextDisabled, pressed && styles.mainButtonTextPressed]}>
            {label.toUpperCase()}
          </Text>
        )
      }
    </Pressable>
  );
}

/* ---------- one-line status / error message ---------- */

export function Notice({ children, tone = 'meta' }: { children: ReactNode; tone?: 'meta' | 'warn' }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.notice, tone === 'warn' && styles.noticeWarn]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
  },
  iconButton: {
    width: MinTap,
    height: MinTap,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: Color.surface,
  },
  title: {
    ...Type.title,
    lineHeight: 32,
    color: Color.white,
  },
  label: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Color.meta,
    marginTop: 20,
    marginBottom: Space.base,
  },
  input: {
    height: 50,
    borderRadius: Radius.input,
    backgroundColor: Color.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    color: Color.white,
    fontFamily: Font.regular,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: Color.violet,
  },
  mainButton: {
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Color.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonPressed: {
    backgroundColor: Color.violetDeep,
    transform: [{ translateY: 1 }],
  },
  mainButtonDisabled: {
    backgroundColor: Color.control,
  },
  mainButtonText: {
    ...Type.mainButton,
    color: Color.black,
  },
  mainButtonTextPressed: {
    color: Color.white,
  },
  mainButtonTextDisabled: {
    color: Color.disabledText,
  },
  notice: {
    ...Type.label,
    fontFamily: Font.regular,
    lineHeight: 18,
    color: Color.meta,
  },
  // No red in our palette: problems are shown in white so they stand out from grey meta text.
  noticeWarn: {
    color: Color.white,
  },
});
