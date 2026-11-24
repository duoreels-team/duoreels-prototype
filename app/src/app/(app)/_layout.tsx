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
          <Stack.Screen name="project/[id]/index" />
          <Stack.Screen name="project/[id]/final" />
          <Stack.Screen name="project/[id]/post" />
          <Stack.Screen name="project/[id]/cover" />
          <Stack.Screen name="project/[id]/brief" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="thread/[k]" />
          <Stack.Screen name="all" />
          <Stack.Screen name="soon" />
        </Stack>
      </OverlayProvider>
    </ProjectsProvider>
  );
}
