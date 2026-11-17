import RNMaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewProps } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LogoMark } from '@/components/brand/logo-mark';
import { PhotoWall } from '@/components/brand/photo-wall';
import { Color, cssAngle, Font, MinTap, Radius, Type } from '@/constants/brand';

// The library's class-based types don't line up with React 19.3's; the component itself works.
const MaskedView = RNMaskedView as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;

const CANVAS_HEIGHT = 844;
const HERO_HEIGHT = 620; // .whero on the 390×844 canvas
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

// .stag > * → s24, staggered 0.04 s
const slideIn = (index: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -44 }, { translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }], easing: ease },
  })
    .duration(550)
    .delay(index * 40);

export default function WelcomeScreen() {
  const { height } = useWindowDimensions();
  const heroHeight = Math.round((height * HERO_HEIGHT) / CANVAS_HEIGHT);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function comingSoon(provider: string) {
    setNotice(`${provider} sign-in is coming soon. Use email for now.`);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Violet glow rising from the bottom */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(16,11,25,0)', 'rgba(105,41,212,0.55)', Color.violetDeep]}
        locations={[0, 0.7, 1]}
        style={styles.glowFloor}
      />

      {/* Slanted photo wall that fades diagonally into the background */}
      <MaskedView
        pointerEvents="none"
        style={[styles.hero, { height: heroHeight }]}
        maskElement={
          <LinearGradient
            colors={['#000', '#000', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'transparent']}
            locations={[0, 0.3, 0.52, 0.68, 0.84]}
            {...cssAngle(168)}
            style={StyleSheet.absoluteFill}
          />
        }>
        <PhotoWall variant="welcome" style={styles.wall} />
        <LinearGradient
          colors={['rgba(16,11,25,0.5)', 'rgba(16,11,25,0.3)', 'rgba(16,11,25,0.6)', 'rgba(16,11,25,0.85)']}
          locations={[0, 0.22, 0.45, 0.7]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(16,11,25,0.5)', 'rgba(16,11,25,0)']}
          locations={[0, 0.7]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>

      <SafeAreaView style={styles.content}>
        <View style={styles.intro}>
          <Animated.View entering={slideIn(0)}>
            <LogoMark size={54} />
          </Animated.View>
          <Animated.Text entering={slideIn(1)} style={styles.headline} accessibilityRole="header">
            {'YOUR POCKET\nSTUDIO.'}
          </Animated.Text>
          <Animated.Text entering={slideIn(2)} style={styles.introLine}>
            Invite your editors, share footage and review every new version from anywhere.
          </Animated.Text>
        </View>

        <View style={styles.actions}>
          <Animated.View entering={slideIn(0)}>
            <AuthButton icon={<AppleIcon />} label="Continue with Apple" onPress={() => comingSoon('Apple')} />
          </Animated.View>
          <Animated.View entering={slideIn(1)}>
            <AuthButton icon={<GoogleIcon />} label="Continue with Google" onPress={() => comingSoon('Google')} />
          </Animated.View>
          <Animated.View entering={slideIn(2)}>
            <AuthButton icon={<MailIcon />} label="Continue with email" onPress={() => router.push('/sign-in')} />
          </Animated.View>
          <Animated.Text entering={slideIn(3)} style={styles.terms} accessibilityLiveRegion="polite">
            {notice ?? 'By continuing you agree to the Terms and Privacy Policy.'}
          </Animated.Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Grey button with the icon fixed on the left and the text centred (.btn-sec.btn-auth). */
function AuthButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.authButton, pressed && styles.authButtonPressed]}>
      <View style={styles.authIcon}>{icon}</View>
      <Text style={styles.authLabel}>{label}</Text>
    </Pressable>
  );
}

function AppleIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        fill={Color.white}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path
        fill={Color.white}
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill={Color.white}
        d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.ink,
  },
  glowFloor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    opacity: 0.75,
  },
  hero: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  wall: {
    left: 5,
    right: 5,
    top: -150,
    height: 900,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  intro: {
    marginTop: 96,
  },
  headline: {
    marginTop: 22,
    fontFamily: Font.display,
    fontSize: 64,
    lineHeight: 68,
    paddingTop: 4,
    letterSpacing: 0.32,
    color: Color.white,
  },
  introLine: {
    ...Type.body,
    marginTop: 14,
    maxWidth: 300,
    color: Color.text2,
  },
  actions: {
    marginTop: 'auto',
    gap: 10,
  },
  authButton: {
    height: 48,
    minHeight: MinTap,
    borderRadius: Radius.input,
    backgroundColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonPressed: {
    backgroundColor: Color.controlPressed,
    transform: [{ scale: 0.97 }],
  },
  authIcon: {
    position: 'absolute',
    left: 22,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authLabel: {
    fontFamily: Font.semibold,
    fontSize: 15,
    color: Color.white,
  },
  terms: {
    ...Type.label,
    fontFamily: Font.regular,
    marginTop: 6,
    textAlign: 'center',
    color: Color.meta,
  },
});
