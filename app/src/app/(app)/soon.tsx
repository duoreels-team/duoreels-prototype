import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingNext } from '@/components/brand/coming-next';
import { TopBar } from '@/components/brand/ui';
import { Color } from '@/constants/brand';

/** Temporary stop for taps that open a screen we haven't built yet. */
export default function SoonScreen() {
  const { title = 'This screen', step = 'a later step' } = useLocalSearchParams<{ title?: string; step?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: Color.black }}>
      <SafeAreaView edges={['top']}>
        <TopBar />
      </SafeAreaView>
      <ComingNext title={title} step={step} />
    </View>
  );
}
