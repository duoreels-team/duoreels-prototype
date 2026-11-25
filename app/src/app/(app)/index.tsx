/**
 * Home shows the live web prototype (#home opens it straight on the creator home).
 * The native version of this screen is kept in home-native.tsx for later.
 */
import { View } from 'react-native';

import PrototypeView from '@/components/prototype-view';
import { Color } from '@/constants/brand';

// ?v= changes on every app start so the phone never shows a cached, older prototype.
const PROTOTYPE_URL = `https://duoreels-team.github.io/duoreels-prototype/?v=${Date.now()}#home`;

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Color.black }}>
      <PrototypeView url={PROTOTYPE_URL} dom={{ style: { flex: 1 }, scrollEnabled: false, bounces: false, contentInsetAdjustmentBehavior: 'never' }} />
    </View>
  );
}
