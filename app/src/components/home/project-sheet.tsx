/**
 * The "⋯" sheet for a project (prototype settingsSheet + delete confirm).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Section, Toggle } from '@/components/brand/bits';
import { DeadlineSheet, EditProjectSheet, PeopleSheet } from '@/components/review/project-sheets';
import { Icon, type IconName } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { useCover, editorName, weekday, type Project } from '@/lib/projects';

type Actions = {
  close: () => void;
  open: (content: React.ReactNode) => void;
  toast: (text: string, undo?: () => void) => void;
  update: (id: string, fields: Partial<Project>) => Promise<string | null>;
  removeLater: (id: string, delayMs: number) => () => void;
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


export function ProjectSheet({ project: p, actions }: { project: Project; actions: Actions }) {
  const ed = editorName(p);
  // Each row opens its own sheet or screen (closing this one first).
  const later = (fn: () => void) => () => setTimeout(fn, 380);
  const about: [IconName, string, string, () => void][] = [
    ['pen', 'Name, type & cover', `${p.name} · ${p.type}`, later(() => actions.open(<EditProjectSheet projectId={p.id} />))],
    ['doc', 'Brief & brand', 'Calm, warm · logo at the end · 2 references', () => router.push(`/project/${p.id}/brief`)],
    ['cal', 'Deadline', p.due_date ? weekday(p.due_date) : '—', later(() => actions.open(<DeadlineSheet projectId={p.id} />))],
    ['people', 'People', `You + ${ed}`, later(() => actions.open(<PeopleSheet projectId={p.id} />))],
  ];

  async function archive() {
    actions.close();
    const before = { status: p.status, done_kind: p.done_kind, finished_at: p.finished_at };
    const problem = await actions.update(p.id, { status: 'done', done_kind: 'archived', finished_at: today() });
    if (problem) {
      actions.toast(problem);
      return;
    }
    actions.toast(`${p.name} moved to Done`, () => actions.update(p.id, before));
  }

  function askDelete() {
    actions.open(<DeleteConfirm project={p} actions={actions} />);
  }

  return (
    <View>
      <View style={styles.head}>
        <SheetThumb project={p} />
        <View style={{ flex: 1 }}>
          <Text style={styles.t17} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.meta}>
            With {ed} · {p.status === 'done' ? 'done' : `round ${Math.max(p.round, 1)} of ${p.rounds} · due ${weekday(p.due_date)}`}
          </Text>
        </View>
      </View>

      <Section title="About this video" style={{ marginTop: 0 }} />
      <View style={styles.list}>
        {about.map(([icon, title, sub, onPress], i) => (
          <SheetRow
            key={title}
            first={i === 0}
            icon={icon}
            title={title}
            sub={sub}
            chevron
            onPress={() => {
              actions.close();
              onPress();
            }}
          />
        ))}
      </View>

      <Section title="For you" />
      <View style={styles.list}>
        <View style={styles.row}>
          <Icon name="bell" size={22} />
          <View style={styles.tx}>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.meta}>New versions and requests</Text>
          </View>
          <NotifyToggle project={p} actions={actions} />
        </View>
      </View>

      <View style={[styles.list, { marginTop: 14 }]}>
        <SheetRow
          first
          icon="dl"
          title={`Download latest (v${p.current_version || 1})`}
          onPress={() => {
            actions.close();
            router.push({ pathname: '/project/[id]', params: { id: p.id, download: '1' } });
          }}
        />
        <SheetRow icon="archive" title="Archive" sub="Moves it to Done, you can bring it back" onPress={archive} />
        <SheetRow icon="trash" title="Delete project" dim onPress={askDelete} />
      </View>
    </View>
  );
}

function SheetThumb({ project }: { project: Project }) {
  const source = useCover(project);
  return <View style={styles.thumb}>{source && <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>;
}

function NotifyToggle({ project: p, actions }: { project: Project; actions: Actions }) {
  return (
    <Toggle
      label="Notifications"
      on={p.notifications}
      onChange={async (on) => {
        // The sheet shows a snapshot, so redraw it with the new value.
        actions.open(<ProjectSheet project={{ ...p, notifications: on }} actions={actions} />);
        const problem = await actions.update(p.id, { notifications: on });
        if (problem) {
          actions.open(<ProjectSheet project={p} actions={actions} />);
          actions.toast(problem);
        }
      }}
    />
  );
}

function DeleteConfirm({ project: p, actions }: { project: Project; actions: Actions }) {
  return (
    <View>
      <Text style={styles.t20}>Delete {p.name}?</Text>
      <Text style={styles.t15}>Notes, versions and the chat go too. This can&apos;t be undone.</Text>
      <View style={styles.pair}>
        <Pressable accessibilityRole="button" onPress={actions.close} style={({ pressed }) => [styles.btnSec, pressed && styles.btnSecPressed]}>
          <Text style={styles.btnSecText}>KEEP IT</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            actions.close();
            const undo = actions.removeLater(p.id, 3200);
            actions.toast(`${p.name} deleted`, undo);
          }}
          style={({ pressed }) => [styles.btnSec, { backgroundColor: Color.white }, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={[styles.btnSecText, { color: Color.black }]}>DELETE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SheetRow({
  icon,
  title,
  sub,
  chevron,
  dim,
  first,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  chevron?: boolean;
  dim?: boolean;
  first?: boolean;
  onPress: () => void;
}) {
  const color = dim ? Color.meta : Color.white;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      <Icon name={icon} size={22} color={color} />
      <View style={styles.tx}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {sub && <Text style={styles.meta}>{sub}</Text>}
      </View>
      {chevron && <Icon name="chev" size={18} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  thumb: {
    width: 42,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  t17: {
    fontFamily: Font.semibold,
    fontSize: 17,
    lineHeight: 21,
    color: Color.white,
  },
  t20: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 24,
    color: Color.white,
    marginTop: 6,
    marginBottom: 8,
  },
  t15: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.text2,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
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
  pair: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btnSec: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecPressed: {
    backgroundColor: Color.controlPressed,
    transform: [{ scale: 0.97 }],
  },
  btnSecText: {
    fontFamily: Font.display,
    fontSize: 20,
    lineHeight: 25,
    paddingTop: 2,
    letterSpacing: 0.6,
    color: Color.white,
  },
});
