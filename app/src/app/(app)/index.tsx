/**
 * Home shows the live web prototype (#home opens it straight on the creator home).
 * The native version of this screen is kept in home-native.tsx for later.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrototypeView from '@/components/prototype-view';
import { Color } from '@/constants/brand';

const PROTOTYPE_URL = 'https://duoreels-team.github.io/duoreels-prototype/#home';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: Color.black, paddingTop: insets.top }}>
      <PrototypeView url={PROTOTYPE_URL} dom={{ style: { flex: 1 }, scrollEnabled: false, bounces: false }} />
    </View>
  );
}
