import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { MainButton } from '@/components/brand/ui';
import { Color, MinTap, Space, Type } from '@/constants/brand';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_900Black,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_500Medium,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <RootNavigator ready={fontsLoaded || !!fontError} />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ ready }: { ready: boolean }) {
  const { session, profile, profileStatus, isLoading, reloadProfile, signOut } = useAuth();
  const show = ready && !isLoading;

  useEffect(() => {
    if (show) SplashScreen.hideAsync();
  }, [show]);

  if (!show) {
    return null;
  }

  // Signed in, but we don't know yet whether they've set up their profile.
  if (session && profileStatus === 'loading') {
    return <LoadingScreen />;
  }
  if (session && profileStatus === 'error') {
    return <ProfileErrorScreen onRetry={reloadProfile} onSignOut={signOut} />;
  }

  const setUp = !!profile?.onboarded_at;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Color.black } }}>
      <Stack.Protected guard={!!session && setUp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !setUp}>
        <Stack.Screen name="setup-profile" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="splash" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={Color.violet} />
    </View>
  );
}

function ProfileErrorScreen({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.message}>Couldn&apos;t load your profile. Check your connection.</Text>
      <View style={styles.actions}>
        <MainButton label="Try again" onPress={onRetry} />
        <Pressable accessibilityRole="button" onPress={onSignOut} hitSlop={12} style={styles.signOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    backgroundColor: Color.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.screenEdge,
    gap: Space.groups,
  },
  message: {
    ...Type.body,
    color: Color.text2,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Space.screenEdge,
  },
  signOut: {
    alignSelf: 'center',
    minHeight: MinTap,
    justifyContent: 'center',
  },
  link: {
    ...Type.label,
    color: Color.violet,
  },
});
