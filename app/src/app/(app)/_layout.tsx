import { Stack } from 'expo-router';

// The prototype draws its own Projects · Marketplace · Me tab bar, so no native tabs here.
export default function SignedInLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
