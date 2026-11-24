import { Stack } from 'expo-router';

import { Color } from '@/constants/brand';
import { OverlayProvider } from '@/providers/overlay-provider';
import { ProjectsProvider } from '@/providers/projects-provider';

export default function SignedInLayout() {
  return (
    <ProjectsProvider>
      <OverlayProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Color.black } }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="new-project" />
          <Stack.Screen name="soon" />
        </Stack>
      </OverlayProvider>
    </ProjectsProvider>
  );
}
