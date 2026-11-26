/**
 * Web preview only (the phone uses the system picker in date-time-field.tsx):
 * the browser's own date + time input.
 */
import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color, Font } from '@/constants/brand';

type Props = { value: Date; minimumDate: Date; onChange: (d: Date) => void };

function local(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function DateTimeField({ value, minimumDate, onChange }: Props) {
  return (
    <View style={styles.box}>
      {createElement('input', {
        type: 'datetime-local',
        value: local(value),
        min: local(minimumDate),
        onChange: (e: { target: { value: string } }) => {
          const d = new Date(e.target.value);
          if (!Number.isNaN(d.getTime())) onChange(d);
        },
        style: {
          width: '100%',
          height: 48,
          padding: '0 14px',
          boxSizing: 'border-box',
          background: Color.control,
          color: Color.white,
          border: 0,
          borderRadius: 12,
          fontFamily: Font.regular,
          fontSize: 15,
          colorScheme: 'dark',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
