/**
 * Prototype topbar(): back · title + grey subtitle · optional right side.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, IconButton } from '@/components/brand/bits';
import type { IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';

export function PageTop({ title, sub, subAvatar, right, backIcon = 'back', onBack }: { title: string; sub?: string; subAvatar?: string; right?: ReactNode; backIcon?: IconName; onBack?: () => void }) {
  return (
    <View style={styles.topbar}>
      <IconButton name={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack ?? (() => router.back())} />
      <View style={styles.tt}>
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!sub && (
          <View style={styles.subRow}>
            {subAvatar && (
              <View style={styles.tiny}>
                <Avatar k={subAvatar} size={14} />
              </View>
            )}
            <Text style={styles.sub} numberOfLines={1}>
              {sub}
            </Text>
          </View>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
  },
  tt: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Font.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: Color.white,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  tiny: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
  },
});
