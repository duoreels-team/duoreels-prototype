/**
 * New project → Details: "First cut" (any future date + time) and "Payment" (up-front split).
 * Same sheet style as "Who edits?".
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/brand/bits';
import { DateTimeField } from '@/components/new-project/date-time-field';
import { Color, Font } from '@/constants/brand';
import { firstCutLabel } from '@/lib/dates';

/* ---------- First cut ---------- */

export function FirstCutSheet({ initial, onDone }: { initial: Date; onDone: (d: Date) => void }) {
  const [now] = useState(() => new Date());
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <View>
      <Text style={styles.t20}>First cut</Text>
      <DateTimeField
        value={value}
        minimumDate={now}
        onChange={(d) => {
          setValue(d);
          setProblem(null);
        }}
      />
      <Text style={[styles.meta, styles.summary, problem && styles.warn]}>{problem ?? firstCutLabel(value)}</Text>
      <BigButton
        label="Done"
        onPress={() => {
          if (value.getTime() <= Date.now()) {
            setProblem('Pick a time after now.');
            return;
          }
          onDone(value);
        }}
      />
    </View>
  );
}

/* ---------- Payment ---------- */

const SPLITS: { up: number; suggested?: boolean }[] = [{ up: 50, suggested: true }, { up: 30 }, { up: 0 }, { up: 100 }];

export function paymentLabel(up: number) {
  return `${up}% now · ${100 - up}% on approval`;
}

export function splitMoney(price: number, up: number) {
  const now = Math.round((price * up) / 100);
  return { now, later: price - now };
}

export function PaymentSheet({ price, initial, onDone }: { price: number; initial: number; onDone: (up: number) => void }) {
  const [text, setText] = useState(String(initial));
  const up = text === '' ? null : Math.min(100, Math.max(0, parseInt(text, 10) || 0));
  const money = up === null ? null : splitMoney(price, up);

  return (
    <View>
      <Text style={styles.t20}>Payment</Text>

      <View style={styles.split}>
        <View style={styles.flex}>
          <Text style={styles.lbl}>UP FRONT</Text>
          <View style={styles.field}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '').slice(0, 3);
                setText(digits === '' ? '' : String(Math.min(100, parseInt(digits, 10))));
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={3}
              accessibilityLabel="Paid up front, in percent"
              selectionColor={Color.violet}
              keyboardAppearance="dark"
              style={styles.input}
            />
            <Text style={styles.unit}>%</Text>
          </View>
        </View>
        <View style={styles.flex}>
          <Text style={styles.lbl}>ON APPROVAL</Text>
          <View style={[styles.field, styles.fieldStill]}>
            <Text style={[styles.input, { color: Color.text2 }]}>{up === null ? '—' : 100 - up}</Text>
            <Text style={styles.unit}>%</Text>
          </View>
        </View>
      </View>

      <View style={styles.chips}>
        {SPLITS.map((s) => {
          const on = up === s.up;
          return (
            <Pressable
              key={s.up}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.up} up front, ${100 - s.up} on approval${s.suggested ? ', suggested' : ''}`}
              onPress={() => setText(String(s.up))}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: Color.black }]}>
                {s.up} / {100 - s.up}
              </Text>
              {s.suggested && <Text style={[styles.chipNote, on && { color: Color.black }]}>Suggested</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.meta, styles.summary]}>{money ? `$${money.now} now · $${money.later} on approval` : 'Type how much is paid up front.'}</Text>

      <BigButton label="Done" disabled={up === null} onPress={() => up !== null && onDone(up)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  t20: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 24,
    color: Color.white,
    marginTop: 4,
    marginBottom: 12,
  },
  lbl: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    color: Color.meta,
    marginBottom: 8,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
  summary: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  warn: {
    color: Color.white,
  },
  split: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Color.control,
  },
  fieldStill: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Color.control,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: Font.mono,
    fontSize: 20,
    lineHeight: 26,
    color: Color.white,
  },
  unit: {
    fontFamily: Font.mono,
    fontSize: 15,
    lineHeight: 20,
    color: Color.meta,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A42',
  },
  chipOn: {
    backgroundColor: Color.white,
    borderColor: Color.white,
  },
  chipText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  chipNote: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
  },
});
