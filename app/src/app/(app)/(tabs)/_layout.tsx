import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/brand/tab-bar';
import { Color } from '@/constants/brand';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: Color.black } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="market" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
