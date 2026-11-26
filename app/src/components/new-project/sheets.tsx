/**
 * Sheets used by New project: "Who edits?" (pickEditor) and "Invite sent" (inviteSheet).
 */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, BigButton, IconButton } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { editorFull } from '@/lib/review';

const EDITORS: [string, string, string][] = [
  ['L', 'Leo Park', 'Worked together 4 times'],
  ['S', 'Sara Kim', 'From Marketplace · $75'],
];

export function editorFullName(k: string) {
  return editorFull(k);
}

export function PickEditorSheet({
  selected,
  onPick,
  onShareLink,
  onMarketplace,
}: {
  selected: string;
  onPick: (k: string) => void;
  onShareLink: () => void;
  onMarketplace: () => void;
}) {
  return (
    <View>
      <Text style={styles.t20}>Who edits?</Text>
      <View style={styles.list}>
        {EDITORS.map(([k, n, m], i) => (
          <Row key={k} first={i === 0} onPress={() => onPick(k)} lead={<Avatar k={k} size={34} />} title={n} sub={m} trail={selected === k ? <Icon name="check" size={18} /> : null} />
        ))}
        <Row onPress={onShareLink} icon="link" title="Share a link instead" sub="Anyone you send it to can join" />
        <Row onPress={onMarketplace} icon="bag" title="Find one in Marketplace" trail={<Icon name="chev" size={18} />} />
      </View>
    </View>
  );
}

export function InviteSheet({
  editorName,
  projectName,
  code,
  onDone,
  onCopied,
}: {
  editorName: string;
  projectName: string;
  code: string;
  onDone: () => void;
  onCopied: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const slug = (projectName || 'reel').toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 14);
  const link = `duoreels.app/j/${slug}-${code}`;
  return (
    <View>
      <Text style={styles.ptitle}>INVITE SENT TO {editorName.toUpperCase()}</Text>
      <Text style={styles.t15}>{editorName} can start as soon as he opens the link. Anyone else you share it with joins too.</Text>
      <View style={styles.linkRow}>
        <Icon name="link" size={18} />
        <Text style={styles.linkText} numberOfLines={1}>
          {link}
        </Text>
        <IconButton
          name={copied ? 'check' : 'copy'}
          label="Copy"
          size={18}
          width={34}
          style={{ height: 34 }}
          onPress={async () => {
            await Clipboard.setStringAsync(`https://${link}`);
            setCopied(true);
            onCopied();
          }}
        />
      </View>
      <View style={{ marginTop: 22 }}>
        <BigButton label="Done" onPress={onDone} />
      </View>
    </View>
  );
}

function Row({
  first,
  onPress,
  icon,
  lead,
  title,
  sub,
  trail,
}: {
  first?: boolean;
  onPress: () => void;
  icon?: IconName;
  lead?: React.ReactNode;
  title: string;
  sub?: string;
  trail?: React.ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      {lead ?? (icon && <Icon name={icon} size={22} />)}
      <View style={styles.tx}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub && <Text style={styles.meta}>{sub}</Text>}
      </View>
      {trail}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  t20: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 24,
    color: Color.white,
    marginTop: 4,
    marginBottom: 12,
  },
  ptitle: {
    fontFamily: Font.display,
    fontSize: 40,
    lineHeight: 42,
    paddingTop: 4,
    letterSpacing: 0.2,
    color: Color.white,
    marginTop: 6,
    marginBottom: 10,
  },
  t15: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.text2,
    marginBottom: 16,
  },
  list: {
    backgroundColor: Color.surface,
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
  tx: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Color.black,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
});
