/**
 * Sheets opened from the review screen, Home and Activity:
 * ask (+1 day), approve, project details, versions, footage, money, people,
 * edit project (rename), deadline — plus the round path (prototype pathHTML).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, BigButton, Chip, Tag } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { InviteSheet } from '@/components/new-project/sheets';
import { FootageSheet, VersionsSection } from '@/components/project/files';
import { Color, Font } from '@/constants/brand';
import { askYesFields, logActivity, markProjectRead } from '@/lib/flow';
import { dotDate, editorName, useCover, weekday, type Project } from '@/lib/projects';
import { addDays, fmt, fullWeekday, money } from '@/lib/review';
import { useProjectFiles } from '@/lib/project-files';
import { useReviewData } from '@/lib/review-store';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

/* ---------- small shared bits ---------- */

function Row({ icon, lead, title, sub, chevron, first, onPress, right }: { icon?: IconName; lead?: React.ReactNode; title: string; sub?: string; chevron?: boolean; first?: boolean; onPress?: () => void; right?: React.ReactNode }) {
  const inner = (
    <>
      {lead ?? (icon && <Icon name={icon} size={22} />)}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.meta}>{sub}</Text> : null}
      </View>
      {right}
      {chevron && <Icon name="chev" size={18} />}
    </>
  );
  if (!onPress) return <View style={[styles.row, !first && styles.rowLine]}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      {inner}
    </Pressable>
  );
}

/** Separate cards with 10 px gaps (prototype .rows). */
function CardRow(props: React.ComponentProps<typeof Row>) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={({ pressed }) => [styles.row, styles.cardRow, pressed && styles.rowPressed]}>
      <Icon name={props.icon!} size={22} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        {props.sub ? <Text style={styles.meta}>{props.sub}</Text> : null}
      </View>
      <Icon name="chev" size={18} />
    </Pressable>
  );
}

/* ---------- the round path: Brief · v1 · v2 · v3 · Post ---------- */

export function PathRow({ project: p }: { project: Project }) {
  const steps = ['Brief', ...Array.from({ length: p.rounds }, (_, i) => `v${i + 1}`), 'Post'];
  const cur =
    p.status === 'done'
      ? steps.length
      : p.current_version === 0
        ? 1
        : Math.min(p.current_version, p.rounds) + (p.turn === 'them' && p.current_version > 0 && p.current_version < p.rounds ? 1 : 0);
  return (
    <View style={styles.path}>
      {steps.map((s, i) => {
        const st = i < cur ? 'ok' : i === cur ? 'now' : 'next';
        return (
          <View key={s} style={styles.pathItem}>
            {i > 0 && <View style={[styles.ln, i <= cur && { backgroundColor: Color.meta }]} />}
            <View style={styles.st}>
              <View style={[styles.c, st === 'ok' && styles.cOk, st === 'now' && styles.cNow, i === cur + 1 && styles.cNext]}>
                {st === 'ok' && <Icon name="check" size={13} strokeWidth={2.4} />}
                {st === 'now' && <Avatar k={p.turn === 'them' ? (p.editor_keys[0] ?? 'L') : 'M'} size={26} />}
              </View>
              <Text style={[styles.stText, st === 'now' && styles.stNow]}>{s}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- ask for one more day (ask / askYes / askNo) ---------- */

export function useAskActions(projectId: string) {
  const { update, refreshProject } = useProjects();
  const { closeSheet, toast } = useOverlay();
  const project = useProject(projectId);

  async function askYes() {
    if (!project) return;
    const ed = editorName(project);
    const before: Partial<Project> = { asks_extra_day: true, turn: 'me', due_date: project.due_date, first_cut_at: project.first_cut_at };
    const fields = askYesFields(project);
    closeSheet();
    const err = await update(projectId, fields);
    if (err) {
      toast(err);
      return;
    }
    await markProjectRead(projectId);
    await logActivity({ project_id: projectId, by_key: 'M', title: `You gave ${ed} 1 more day`, body: `${ed} has until ${weekday(fields.due_date!)} · ${project.name}` });
    refreshProject(projectId);
    toast(`${ed} has until ${weekday(fields.due_date!)}`, async () => {
      await update(projectId, before);
      refreshProject(projectId);
    });
  }

  async function askNo() {
    if (!project) return;
    const ed = editorName(project);
    closeSheet();
    const err = await update(projectId, { asks_extra_day: false, turn: 'them' });
    if (err) {
      toast(err);
      return;
    }
    await markProjectRead(projectId);
    await logActivity({ project_id: projectId, by_key: 'M', title: `You kept ${fullWeekday(project.due_date)}`, body: `Told ${ed} ${fullWeekday(project.due_date)} still stands · ${project.name}` });
    refreshProject(projectId);
    toast(`Told ${ed} ${fullWeekday(project.due_date)} still stands`);
  }

  return { askYes, askNo };
}

export function AskSheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const { askYes, askNo } = useAskActions(projectId);
  if (!p) return null;
  const ed = p.editor_keys[0] ?? 'L';
  return (
    <View>
      <View style={styles.askHead}>
        <Avatar k={ed} size={40} />
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { fontSize: 16 }]}>{editorName(p)} asks for 1 more day</Text>
          <Text style={styles.meta}>
            {p.name} · due {dotDate(p.due_date)} → {dotDate(addDays(p.due_date, 1))}
          </Text>
        </View>
      </View>
      <View style={styles.quoteCard}>
        <Text style={styles.t15}>&quot;Need one more day for the colour pass. Want it to look right.&quot;</Text>
      </View>
      <View style={styles.pair}>
        <BigButton label="Accept" onPress={askYes} style={styles.flex} />
        <BigButton label="Decline" tone="control" onPress={askNo} style={styles.flex} />
      </View>
    </View>
  );
}

/* ---------- approve (approve / approveYes) ---------- */

export function ApproveSheet({ projectId, onApprove }: { projectId: string; onApprove: () => void }) {
  const p = useProject(projectId);
  const { closeSheet } = useOverlay();
  if (!p) return null;
  return (
    <View>
      <Tag label={`Approve v${p.current_version}`} tone="violet" height={24} />
      <Text style={styles.t28}>Make v{p.current_version} the final?</Text>
      <Text style={[styles.t15, { color: Color.text2 }]}>
        ${money(p).onApproval} goes to {editorName(p)} now. You can still download and post it any time.
      </Text>
      <View style={styles.pair}>
        <BigButton label="Approve" onPress={onApprove} style={styles.flex} />
        <BigButton label="Not yet" tone="control" onPress={closeSheet} style={styles.flex} />
      </View>
    </View>
  );
}

/* ---------- project details (detailsSheet) ---------- */

export function DetailsSheet({
  projectId,
  onVersions,
  onMore,
  demo,
}: {
  projectId: string;
  onVersions: () => void;
  /** "Rename, archive or delete" → the Home ⋯ sheet. */
  onMore: () => void;
  demo: { upload: () => void; ask: () => void };
}) {
  const p = useProject(projectId);
  const data = useReviewData(projectId);
  const { openSheet, closeSheet } = useOverlay();
  const files = useProjectFiles(projectId);
  const counts = { clips: files.rows.filter((r) => r.kind === 'clip').length, refs: files.rows.filter((r) => r.kind === 'reference').length };

  if (!p) return null;
  const v = p.current_version;
  const m = money(p);
  const round = Math.max(p.round, 1);
  const go = (fn: () => void) => () => {
    closeSheet();
    setTimeout(fn, 380);
  };
  const rows: [IconName, string, string, () => void][] = [
    ['compare', 'Versions', v ? `v${v} current${v > 1 ? ` · v${v - 1}` : ''}${v > 2 ? ' · v1' : ''}` : `v1 comes from ${editorName(p)}`, go(onVersions)],
    ['footage', 'Footage', `${p.is_sample && !counts.clips ? 6 : counts.clips} clip${(p.is_sample && !counts.clips ? 6 : counts.clips) === 1 ? '' : 's'} · tap to watch or add`, go(() => openSheet(<FootageSheet projectId={projectId} />))],
    ['list', 'Brief and references', `${p.is_sample && !counts.refs ? 2 : counts.refs} reference${(p.is_sample && !counts.refs ? 2 : counts.refs) === 1 ? '' : 's'}${p.brief ? ' · brief written' : ''}`, go(() => router.push(`/project/${projectId}/brief`))],
    ['cover', 'Cover and caption', p.cover_seconds !== null ? `Frame at ${fmt(p.cover_seconds)} · tap to change` : 'Auto: frame at 0:21 · tap to change', go(() => router.push(`/project/${projectId}/cover`))],
    ['money', 'Money', `$${m.price} · $${m.onApproval} on approval`, go(() => openSheet(<MoneySheet projectId={projectId} />))],
    ['people', 'People', `You + ${editorName(p)} · Share link to invite`, go(() => openSheet(<PeopleSheet projectId={projectId} />))],
  ];
  return (
    <View>
      <Text style={[styles.t20, { marginBottom: 4 }]}>{p.name}</Text>
      <Text style={styles.meta}>
        Round {round} of {p.rounds} · {p.rounds - round} left
      </Text>
      <PathRow project={p} />
      <View style={{ gap: 10, marginTop: 12 }}>
        {rows.map(([icon, title, sub, onPress]) => (
          <CardRow key={title} icon={icon} title={title} sub={sub} onPress={onPress} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onMore}
        hitSlop={8}
        style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text style={styles.meta}>Rename, archive or delete</Text>
      </Pressable>

      {/* Demo: the editor isn't a real person yet, so you can play their part (prototype "Simulate"). */}
      <Text style={styles.lbl}>DEMO · {editorName(p).toUpperCase()}&apos;S SIDE</Text>
      <View style={styles.list}>
        <Row first icon="bolt" title={`${editorName(p)} uploads the next version`} sub={`v${Math.min(v + 1, 9)} arrives with a banner`} onPress={() => { closeSheet(); demo.upload(); }} />
        <Row icon="cal" title={`${editorName(p)} asks for +1 day`} sub={`${dotDate(p.due_date)} → ${dotDate(addDays(p.due_date, 1))}`} onPress={() => { closeSheet(); demo.ask(); }} />
      </View>
      {data.status === 'error' && <Text style={[styles.meta, { marginTop: 8 }]}>Couldn&apos;t load versions. Pull down to retry.</Text>}
    </View>
  );
}

/* ---------- versions (versions / compareFromSheet) ---------- */

/** v1…vN with picture, date and note count; tap one to watch it. */
export function VersionsSheet({ projectId, onCompare }: { projectId: string; onCompare?: () => void }) {
  const p = useProject(projectId);
  if (!p) return null;
  const cur = p.current_version;
  return (
    <View>
      <Text style={[styles.t20, { marginBottom: 10 }]}>Versions</Text>
      <VersionsSection projectId={projectId} />
      {cur > 1 && onCompare && (
        <View style={{ marginTop: 14 }}>
          <BigButton label={`Compare v${cur - 1} and v${cur}`} tone="control" onPress={onCompare} />
        </View>
      )}
    </View>
  );
}

/* ---------- footage: the shared section (components/project/files) ---------- */

export { FootageSheet };

/* ---------- money ---------- */

export function MoneySheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  if (!p) return null;
  const m = money(p);
  return (
    <View>
      <Text style={styles.t20}>Money</Text>
      <View style={styles.list}>
        {[
          ['Price', `$${m.price}`],
          [`Paid now · ${p.upfront_percent}%`, `$${m.now}`],
          [`On approval · ${100 - p.upfront_percent}%`, `$${m.onApproval}`],
          ['Service fee 5%', `$${m.fee}`],
        ].map(([a, b], i) => (
          <Row key={a} first={i === 0} title={a} right={<Text style={styles.monoVal}>{b}</Text>} />
        ))}
      </View>
      <Text style={[styles.meta, { marginTop: 12 }]}>{editorName(p)} gets the rest the moment you approve the final.</Text>
    </View>
  );
}

/* ---------- people (+ share link) ---------- */

export function PeopleSheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const { openSheet, closeSheet, toast } = useOverlay();
  if (!p) return null;
  const ed = p.editor_keys[0] ?? 'L';
  async function share() {
    if (!p) return;
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('invites').insert({ project_id: p.id, editor_key: ed, invited_by: user.user?.id, status: 'pending' }).select('code').single();
    if (error) {
      toast("Couldn't make the link · check your connection");
      return;
    }
    openSheet(<InviteSheet editorName={editorName(p)} projectName={p.name} code={data.code} onDone={closeSheet} onCopied={() => toast('Link copied')} />);
  }
  return (
    <View>
      <Text style={styles.t20}>People</Text>
      <View style={styles.list}>
        <Row first lead={<Avatar k="M" size={34} />} title="You" sub="Creator" />
        <Row lead={<Avatar k={ed} size={34} />} title={editorName(p)} sub="Editor" />
      </View>
      <View style={{ marginTop: 14 }}>
        <BigButton label="Share link to invite" tone="control" onPress={share} />
      </View>
    </View>
  );
}

/* ---------- edit project (editName / saveName) ---------- */

const TYPES = ['Vlog', 'Food', 'Talking head', 'Product', 'Travel'];

export function EditProjectSheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const { closeSheet, toast } = useOverlay();
  const { update } = useProjects();
  const [name, setName] = useState(p?.name ?? '');
  const [type, setType] = useState(p?.type ?? 'Vlog');
  const cover = useCover(p ?? { cover_image: null });
  if (!p) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
        <Text style={[styles.t20, styles.flex, { margin: 0 }]}>Edit project</Text>
        <Pressable accessibilityRole="button" onPress={closeSheet} hitSlop={10}>
          <Text style={[styles.rowTitle, { color: Color.meta, fontSize: 14 }]}>Cancel</Text>
        </Pressable>
      </View>
      <Text style={styles.lbl}>NAME</Text>
      <TextInput value={name} onChangeText={setName} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.field} accessibilityLabel="Name" />
      <Text style={styles.lbl}>TYPE · USED BY FILTER</Text>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <Chip key={t} label={t} on={type === t} onPress={() => setType(t)} />
        ))}
      </View>
      <Text style={styles.lbl}>COVER</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={styles.coverThumb}>{cover && <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Frame at {p.cover_seconds !== null ? fmt(p.cover_seconds) : '0:21'}</Text>
          <Text style={styles.meta}>Square, centre crop · works for 9:16 and 16:9</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            closeSheet();
            router.push(`/project/${projectId}/cover`);
          }}
          style={styles.smBtn}>
          <Text style={styles.smBtnText}>CHANGE</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 20 }}>
        <BigButton
          label="Save"
          onPress={async () => {
            closeSheet();
            const err = await update(projectId, { name: name.trim() || p.name, type });
            toast(err ?? 'Saved');
          }}
        />
      </View>
    </View>
  );
}

/* ---------- deadline (deadline / saveDeadline) ---------- */

export function DeadlineSheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const { closeSheet, toast } = useOverlay();
  const { update } = useProjects();
  // The next Thu, Fri, Sat, Mon, Tue from today, like the prototype's chips.
  const [days] = useState(() => {
    const out: string[] = [];
    for (let i = 0; out.length < 5 && i < 14; i++) {
      const iso = addDays(null, i);
      if (['Thu', 'Fri', 'Sat', 'Mon', 'Tue'].includes(weekday(iso)) && !out.some((d) => weekday(d) === weekday(iso))) out.push(iso);
    }
    const order = ['Thu', 'Fri', 'Sat', 'Mon', 'Tue'];
    return out.sort((a, b) => (a < b ? -1 : 1)).sort((a, b) => order.indexOf(weekday(a)) - order.indexOf(weekday(b)) || (a < b ? -1 : 1));
  });
  const [day, setDay] = useState(p?.due_date ?? days[1]);
  const [time, setTime] = useState(18);
  if (!p) return null;
  return (
    <View>
      <Text style={[styles.t20, { marginBottom: 4 }]}>Deadline</Text>
      <Text style={[styles.meta, { marginBottom: 12 }]}>
        {p.name} · {editorName(p)} sees the change right away
      </Text>
      <View style={styles.chips}>
        {days.map((d) => (
          <Chip key={d} label={weekday(d)} on={day === d} onPress={() => setDay(d)} />
        ))}
      </View>
      <Text style={styles.lbl}>TIME</Text>
      <View style={styles.seg}>
        {[
          [12, '12 pm'],
          [18, '6 pm'],
          [21, '9 pm'],
        ].map(([h, l]) => (
          <Pressable key={h} accessibilityRole="button" accessibilityState={{ selected: time === h }} onPress={() => setTime(h as number)} style={[styles.segBtn, time === h && styles.segOn]}>
            <Text style={[styles.segText, time === h && { color: Color.black }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <BigButton
          label="Save"
          onPress={async () => {
            closeSheet();
            const at = new Date(`${day}T00:00:00`);
            at.setHours(time, 0, 0, 0);
            const fields: Partial<Project> = { due_date: day };
            if (!p.current_version) fields.first_cut_at = at.toISOString();
            const err = await update(projectId, fields);
            toast(err ?? `New deadline ${weekday(day)} · ${editorName(p)} is told`);
          }}
        />
      </View>
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
  t28: {
    fontFamily: Font.bold,
    fontSize: 28,
    lineHeight: 32,
    color: Color.white,
    marginTop: 14,
    marginBottom: 6,
  },
  t15: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.white,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
  lbl: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    color: Color.meta,
    marginTop: 20,
    marginBottom: 8,
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
  cardRow: {
    backgroundColor: Color.control,
    borderRadius: 12,
  },
  rowLine: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A2E',
  },
  rowPressed: {
    backgroundColor: '#26262A',
  },
  rowTitle: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  monoVal: {
    fontFamily: Font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
  askHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  quoteCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Color.control,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  path: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    marginBottom: 4,
  },
  pathItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ln: {
    flex: 1,
    height: 1.5,
    marginTop: 13,
    backgroundColor: '#3A3A42',
  },
  st: {
    width: 44,
    alignItems: 'center',
    gap: 6,
  },
  c: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#4A4A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cOk: {
    backgroundColor: Color.control,
    borderColor: Color.control,
  },
  cNow: {
    borderWidth: 0,
  },
  cNext: {
    borderStyle: 'dashed',
  },
  stText: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
  },
  stNow: {
    fontFamily: Font.semibold,
    color: Color.white,
  },
  field: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: Color.surface,
    borderWidth: 1.5,
    borderColor: Color.control,
    fontFamily: Font.regular,
    fontSize: 15,
    color: Color.white,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coverThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  smBtn: {
    height: 44,
    minWidth: 96,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smBtnText: {
    fontFamily: Font.display,
    fontSize: 18,
    lineHeight: 23,
    paddingTop: 2,
    letterSpacing: 0.54,
    color: Color.white,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: '#141416',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: {
    backgroundColor: Color.white,
  },
  segText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.text2,
  },
});
