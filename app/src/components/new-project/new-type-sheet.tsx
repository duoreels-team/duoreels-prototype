/**
 * "+ New type" (prototype npNewType): name a type, "Add type".
 * The new type is selected, saved on your profile and used by the Marketplace filter.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/brand/bits';
import { Color, Font } from '@/constants/brand';

export function NewTypeSheet({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState('');
  const [problem, setProblem] = useState(false);
  const add = () => {
    const name = v.trim().replace(/\s+/g, ' ');
    if (!name) {
      setProblem(true);
      return;
    }
    onAdd(name.replace(/^./, (c) => c.toUpperCase()));
  };
  return (
    <View>
      <Text style={styles.t20}>New type</Text>
      <TextInput
        autoFocus
        value={v}
        onChangeText={(t) => {
          setV(t);
          setProblem(false);
        }}
        placeholder="e.g. Fitness"
        placeholderTextColor={Color.meta}
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={add}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        accessibilityLabel="New type"
        style={styles.field}
      />
      {problem && <Text style={styles.meta}>Type a name first.</Text>}
      <BigButton label="Add type" onPress={add} style={{ marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 2, marginBottom: 12 },
  field: { height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.white, marginTop: 8 },
});
