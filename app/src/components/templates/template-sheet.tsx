/**
 * NEW · Add / edit a brief template: title, type, brief, references (links).
 * Also the "Use a template" picker for New project.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton, Chip } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { saveTemplate, type Template } from '@/lib/templates';

const TYPES = ['Vlog', 'Food', 'Talking head', 'Product', 'Travel'];

export function TemplateSheet({ template, onSaved, onDelete }: { template?: Template; onSaved: () => void; onDelete?: () => void }) {
  const [title, setTitle] = useState(template?.title ?? '');
  const [type, setType] = useState(template?.type ?? 'Vlog');
  const [brief, setBrief] = useState(template?.brief ?? '');
  const [refs, setRefs] = useState(template?.references_text ?? '');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setProblem('Give it a title first.');
      return;
    }
    setSaving(true);
    const { error } = await saveTemplate({ id: template?.id, title: title.trim(), type, brief: brief.trim(), references_text: refs.trim() });
    setSaving(false);
    if (error) {
      setProblem("Couldn't save · check your connection");
      return;
    }
    onSaved();
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Text style={[styles.t20, { flex: 1 }]}>{template ? 'Edit template' : 'New template'}</Text>
        {onDelete && (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete template" onPress={onDelete} hitSlop={10}>
            <Icon name="trash" size={20} color={Color.meta} />
          </Pressable>
        )}
      </View>
      <Text style={styles.lbl}>TITLE</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Cozy vlog, 30–45 s" placeholderTextColor={Color.meta} maxLength={60} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.field} />
      <Text style={styles.lbl}>TYPE</Text>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <Chip key={t} label={t} on={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      <Text style={styles.lbl}>THE BRIEF</Text>
      <TextInput
        value={brief}
        onChangeText={setBrief}
        multiline
        placeholder="What should it feel like? Length, pace, music, captions…"
        placeholderTextColor={Color.meta}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        style={[styles.field, styles.area]}
      />
      <Text style={styles.lbl}>REFERENCES</Text>
      <TextInput
        value={refs}
        onChangeText={setRefs}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Links to videos you like, one per line"
        placeholderTextColor={Color.meta}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        style={[styles.field, styles.area, { minHeight: 70 }]}
      />
      {problem && <Text style={[styles.meta, { color: Color.white, marginTop: 8 }]}>{problem}</Text>}
      <BigButton label="Save template" loading={saving} onPress={save} style={{ marginTop: 18 }} />
    </View>
  );
}

export function UseTemplateSheet({ list, onPick, onManage }: { list: Template[]; onPick: (t: Template) => void; onManage: () => void }) {
  return (
    <View>
      <Text style={[styles.t20, { marginTop: 4, marginBottom: 12 }]}>Use a template</Text>
      <View style={styles.list}>
        {list.map((t, i) => (
          <Pressable key={t.id} accessibilityRole="button" onPress={() => onPick(t)} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { backgroundColor: '#26262A' }]}>
            <Icon name="doc" size={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {t.type} · {t.brief || 'No brief yet'}
              </Text>
            </View>
          </Pressable>
        ))}
        {list.length === 0 && <Text style={[styles.meta, { padding: 14 }]}>No templates yet.</Text>}
      </View>
      <BigButton label={list.length ? 'Manage templates' : 'Make a template'} tone="control" onPress={onManage} style={{ marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 18, marginBottom: 8 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  field: { height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  area: { height: undefined, minHeight: 92, paddingTop: 13, paddingBottom: 13, lineHeight: 22, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { backgroundColor: Color.control, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
});
