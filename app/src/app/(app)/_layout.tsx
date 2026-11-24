import { Stack } from 'expo-router';

import { Color } from '@/constants/brand';
import { OverlayProvider } from '@/providers/overlay-provider';
import { ProjectsProvider } from '@/providers/projects-provider';
import { ViewRoleProvider } from '@/providers/view-role';

/** Screens with a timeline, cover strip or range handles: a drag must never pop the screen. */
const NO_SWIPE_BACK = { gestureEnabled: false, fullScreenGestureEnabled: false } as const;

export default function SignedInLayout() {
  return (
    <ProjectsProvider>
      <ViewRoleProvider>
      <OverlayProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Color.black } }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="new-project" />
          <Stack.Screen name="project/[id]/index" options={NO_SWIPE_BACK} />
          <Stack.Screen name="project/[id]/final" options={NO_SWIPE_BACK} />
          <Stack.Screen name="project/[id]/post" />
          <Stack.Screen name="project/[id]/cover" options={NO_SWIPE_BACK} />
          <Stack.Screen name="project/[id]/brief" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="thread/[k]" />
          <Stack.Screen name="all" />
          <Stack.Screen name="editor/[k]" />
          <Stack.Screen name="saved" />
          <Stack.Screen name="profile-edit" />
          <Stack.Screen name="payments" />
          <Stack.Screen name="payment/[id]" />
          <Stack.Screen name="pay-with" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="credits" />
          <Stack.Screen name="templates" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="join/[invite]" />
          <Stack.Screen name="ed-project/[id]" options={NO_SWIPE_BACK} />
          <Stack.Screen name="soon" />
        </Stack>
      </OverlayProvider>
      </ViewRoleProvider>
    </ProjectsProvider>
  );
}
