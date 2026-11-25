/**
 * Pick any future date + time.
 * iOS: the system calendar + time, inline and dark. Android: tap Date / Time rows,
 * each opens the system picker.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { dayLabel, timeLabel } from '@/lib/dates';

type Props = { value: Date; minimumDate: Date; onChange: (d: Date) => void };

export function DateTimeField({ value, minimumDate, onChange }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosBox}>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="inline"
          minimumDate={minimumDate}
          minuteInterval={5}
          themeVariant="dark"
          accentColor={Color.violet}
          textColor={Color.white}
          onChange={(_, d) => d && onChange(d)}
          style={styles.ios}
        />
      </View>
    );
  }

  const open = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value,
      mode,
      minimumDate,
      is24Hour: false,
      onChange: (event, d) => {
        if (event.type === 'set' && d) onChange(d);
      },
    });

  return (
    <View style={styles.list}>
      <Pressable accessibilityRole="button" onPress={() => open('date')} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.rowLabel}>Date</Text>
        <Text style={styles.rowValue}>{dayLabel(value)}</Text>
        <Icon name="chev" size={16} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => open('time')} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
        <Text style={styles.rowLabel}>Time</Text>
        <Text style={styles.rowValue}>{timeLabel(value)}</Text>
        <Icon name="chev" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  iosBox: {
    backgroundColor: Color.control,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ios: {
    alignSelf: 'stretch',
  },
  list: {
    backgroundColor: Color.control,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowLine: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A2E',
  },
  rowPressed: {
    backgroundColor: '#26262A',
  },
  rowLabel: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  rowValue: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
});
