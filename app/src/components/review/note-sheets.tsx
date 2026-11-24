/**
 * Review sheets for notes:
 *  • NoteSheet   — add or edit one note (prototype addNoteAt / saveNote / aiNote)
 *  • NotesSheet  — "To send" drafts and "All" notes (notesSheet: tick, reply, edit, delete, tidy, send)
 *  • ReplySheet  — reply to a note (replyNote / sendReply)
 */
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Avatar, BigButton } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { AttachedImage, AudioChip, LinkChip } from '@/components/review/attachments';
import { DrawingOverlay } from '@/components/review/draw-layer';
import { Color, Font } from '@/constants/brand';
import { sendNotes as saveSend, unsendNotes } from '@/lib/flow';
import { person } from '@/lib/people';
import { editorName } from '@/lib/projects';
import { fmt, fmtRange, type Note, type NoteKind } from '@/lib/review';
import { deleteNoteLater, drafts as draftsOf, sentNotes, updateNotes, useReviewData, versionNumber } from '@/lib/review-store';
import { useSignedUrl } from '@/lib/storage';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ATT_LABEL: Partial<Record<NoteKind, string>> = { draw: 'Drawing', voice: 'Voice', range: 'Range', image: 'Image' };
const ATT_ICON: Partial<Record<NoteKind, IconName>> = { draw: 'pen', voice: 'mic', range: 'range', image: 'image' };

function AttChip({ kind, big }: { kind: NoteKind; big?: boolean }) {
  const label = ATT_LABEL[kind];
  if (!label) return null;
  return (
    <View style={[styles.att, big && styles.attBig]}>
      <Icon name={ATT_ICON[kind]!} size={12} color={Color.text2} />
      <Text style={styles.attText}>{label}</Text>
    </View>
  );
}

/* ================= NotesSheet ================= */

function Shimmer({ children, on }: { children: string; on: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = on ? withRepeat(withSequence(withTiming(0.35, { duration: 550 }), withTiming(1, { duration: 550 })), -1) : withTiming(1);
  }, [on, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.Text style={[styles.ntxt, style]}>{children}</Animated.Text>;
}

function NoteThumb({ picture, n }: { picture: ImageSource | null; n: Note }) {
  const drawing = useSignedUrl(n.drawing_path);
  return (
    <View style={styles.nt}>
      {picture && <Image source={picture} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: `${(n.time_seconds * 9) % 100}%`, top: '40%' }} />}
      {drawing ? (
        <Image source={{ uri: drawing }} style={StyleSheet.absoluteFill} contentFit="fill" />
      ) : n.drawing_svg ? (
        <DrawingOverlay svg={n.drawing_svg} />
      ) : n.kind === 'draw' ? (
        <View style={styles.ringMark} />
      ) : (
        <View style={styles.pdot} />
      )}
    </View>
  );
}

/** The picture, voice clip and link a note carries (tap to open / play). */
function NoteExtras({ n }: { n: Note }) {
  if (!n.image_path && !n.audio_path && !n.link_url) return null;
  return (
    <View style={styles.extras}>
      {n.image_path && <AttachedImage path={n.image_path} size={44} />}
      <View style={{ gap: 6, flexShrink: 1, minWidth: 0 }}>
        {n.audio_path && <AudioChip path={n.audio_path} />}
        {n.link_url && <LinkChip url={n.link_url} />}
      </View>
    </View>
  );
}

/** Swipe left to show Delete (like Mail). Hidden while notes fly out. */
function DraftRow({
  n,
  picture,
  tidying,
  flyIndex,
  register,
  onEdit,
  onDelete,
}: {
  n: Note;
  picture: ImageSource | null;
  tidying: boolean;
  flyIndex: number | null;
  register: (id: string, m: SwipeableMethods | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fly = useSharedValue(0);

  useEffect(() => {
    if (flyIndex !== null) fly.value = withDelay(flyIndex * 90, withTiming(1, { duration: 420 }));
  }, [flyIndex, fly]);

  // .fly in index.html: slide up and away while fading.
  const flyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fly.value * 160 }, { translateY: fly.value * -71 }],
    opacity: 1 - fly.value,
  }));

  return (
    <Animated.View layout={LinearTransition.duration(250)} exiting={FadeOut.duration(220)} style={flyStyle}>
      <Swipeable
        ref={(m) => register(n.id, m)}
        enabled={flyIndex === null}
        friction={1.6}
        rightThreshold={44}
        overshootRight={false}
        renderRightActions={
          flyIndex === null
            ? (_p, _t, methods) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                  onPress={() => {
                    methods.close();
                    onDelete();
                  }}
                  style={styles.ndel}>
                  <Icon name="trash" size={20} color={Color.white} />
                  <Text style={styles.ndelText}>Delete</Text>
                </Pressable>
              )
            : undefined
        }>
        <View style={styles.nrow}>
          <NoteThumb picture={picture} n={n} />
          <View style={styles.flex}>
            <Text style={styles.ntime}>{fmtRange(n)}</Text>
            {n.body ? <Shimmer on={tidying}>{n.body}</Shimmer> : null}
            <AttChip kind={n.kind} big />
            <NoteExtras n={n} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={onEdit} hitSlop={6} style={styles.editBtn}>
            <Icon name="pen" size={20} strokeWidth={1.6} color="#DDDDDD" />
          </Pressable>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

/** Tidy up: same words, cleaner — trims, drops "please / maybe / can you", capital + full stop. */
function tidyText(s: string) {
  const t = s.replace(/\s+/g, ' ').trim().replace(/^(please|maybe|can you|could you)\s+/i, '');
  return t.replace(/^./, (c) => c.toUpperCase()).replace(/[.!?]*$/, '.');
}

export function NotesSheet({
  projectId,
  picture,
  initialTab = 'send',
  onEditDraft,
  onApprove,
  onSent,
}: {
  projectId: string;
  picture: ImageSource | null;
  initialTab?: 'send' | 'all';
  onEditDraft: (n: Note) => void;
  onApprove: () => void;
  onSent: () => void;
}) {
  const project = useProject(projectId);
  const data = useReviewData(projectId);
  const { refreshProject, setLocal } = useProjects();
  const { closeSheet, openSheet, toast } = useOverlay();
  const [tab, setTab] = useState<'send' | 'all'>(initialTab);
  const [nv, setNv] = useState(0);
  const [doneOpen, setDoneOpen] = useState(false);
  const [tidying, setTidying] = useState(false);
  const [flying, setFlying] = useState(false);
  const swipes = useRef(new Map<string, SwipeableMethods>());
  const register = (rowId: string, m: SwipeableMethods | null) => {
    if (m) swipes.current.set(rowId, m);
    else swipes.current.delete(rowId);
  };

  if (!project) return null;
  const ed = editorName(project);
  const send = draftsOf(data);
  const allSent = sentNotes(data);
  const all = allSent.filter((n) => !nv || versionNumber(data, n.version_id) === nv);
  const openA = all.filter((n) => !n.done);
  const doneA = all.filter((n) => n.done);
  const versions = [0, ...Array.from(new Set(allSent.map((n) => versionNumber(data, n.version_id)))).sort()];
  const v = project.current_version;

  async function tidy() {
    setTidying(true);
    await sleep(1200);
    await Promise.all(send.map((d) => updateNotes(projectId, [d.id], { body: tidyText(d.body) })));
    setTidying(false);
    toast(`Tidied ${send.length} note${send.length === 1 ? '' : 's'} · same meaning, shorter`);
  }

  async function sendAll() {
    if (!project || !send.length) return;
    const n = send.length;
    const sent = [...send];
    // Close any open Delete first, then the rows fly out one by one.
    swipes.current.forEach((m) => m.close());
    await sleep(swipes.current.size ? 220 : 0);
    setFlying(true);
    await sleep(n * 90 + 420);
    const res = await saveSend(project, sent);
    if (res.error) {
      setFlying(false);
      toast(res.error);
      return;
    }
    await updateNotes(projectId, sent.map((d) => d.id), { status: 'sent' });
    setLocal(projectId, { new_version: false, turn: 'them' });
    closeSheet();
    onSent();
    refreshProject(projectId);
    toast(`${n} note${n > 1 ? 's' : ''} sent to ${ed}`, async () => {
      await unsendNotes(project, sent);
      await updateNotes(projectId, sent.map((d) => d.id), { status: 'draft' });
      setLocal(projectId, { new_version: true, turn: 'me' });
      refreshProject(projectId);
    });
  }

  return (
    <View>
      <View style={styles.nhead}>
        <Text style={styles.nheadTitle}>Notes</Text>
        <View style={styles.nseg}>
          {(['send', 'all'] as const).map((k) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[styles.nsegBtn, tab === k && styles.nsegOn]}>
              <Text style={[styles.nsegText, tab === k && { color: Color.black }]}>{k === 'send' ? `To send ${send.length}` : `All ${allSent.length}`}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'send' ? (
        <>
          <Text style={styles.meta}>Drafts on v{v} · only you see them</Text>
          <View>
            {send.length ? (
              send.map((n, i) => (
                <DraftRow
                  key={n.id}
                  n={n}
                  picture={picture}
                  tidying={tidying}
                  flyIndex={flying ? i : null}
                  register={register}
                  onEdit={() => onEditDraft(n)}
                  onDelete={() => {
                    const undo = deleteNoteLater(projectId, n.id);
                    toast('Note deleted', undo);
                  }}
                />
              ))
            ) : (
              <Text style={styles.empty}>No drafts yet. Tap the video to pin a note.</Text>
            )}
          </View>
          <View style={styles.nsend}>
            {send.length ? (
              <>
                <Pressable accessibilityRole="button" onPress={tidy} disabled={tidying} style={({ pressed }) => [styles.ntidy, pressed && { backgroundColor: Color.controlPressed }]}>
                  <Icon name="spark" size={16} />
                  <Text style={styles.ntidyText}>TIDY UP</Text>
                </Pressable>
                <BigButton label={`Send ${send.length} note${send.length > 1 ? 's' : ''} to ${ed}`} onPress={sendAll} style={styles.flex} />
              </>
            ) : (
              <BigButton label={`Approve v${v}`} onPress={onApprove} style={styles.flex} />
            )}
          </View>
        </>
      ) : (
        <>
          <Pressable accessibilityRole="button" onPress={() => setNv(versions[(versions.indexOf(nv) + 1) % versions.length])} style={styles.vchip}>
            <Text style={styles.vchipText}>{nv ? `v${nv}` : 'All versions'}</Text>
            <Icon name="down" size={14} />
          </Pressable>
          <View>
            {openA.length ? (
              openA.map((n) => <AllRow key={n.id} n={n} picture={picture} v={v} nv={versionNumber(data, n.version_id)} projectId={projectId} openReply={() => openSheet(<ReplySheet projectId={projectId} note={n} onDone={() => openSheet(<NotesSheet {...{ projectId, picture, onEditDraft, onApprove, onSent }} initialTab="all" />)} />)} />)
            ) : (
              <Text style={styles.empty}>Nothing open.</Text>
            )}
          </View>
          {doneA.length > 0 && (
            <>
              <Pressable accessibilityRole="button" onPress={() => setDoneOpen((o) => !o)} style={styles.ndone}>
                <Text style={styles.ndoneText}>Done · {doneA.length}</Text>
                <View style={{ transform: [{ rotate: doneOpen ? '180deg' : '0deg' }] }}>
                  <Icon name="down" size={16} color={Color.text2} />
                </View>
              </Pressable>
              {doneOpen && doneA.map((n) => <AllRow key={n.id} n={n} picture={picture} v={v} nv={versionNumber(data, n.version_id)} projectId={projectId} openReply={() => {}} />)}
            </>
          )}
          <View style={{ height: 20 }} />
        </>
      )}
    </View>
  );
}

function AllRow({ n, picture, v, nv, projectId, openReply }: { n: Note; picture: ImageSource | null; v: number; nv: number; projectId: string; openReply: () => void }) {
  const { toast } = useOverlay();
  const who = n.by_key === 'M' ? 'You' : person(n.by_key).name;
  return (
    <View style={[styles.nrow, n.done && { opacity: 0.35 }]}>
      <NoteThumb picture={picture} n={n} />
      <View style={styles.flex}>
        <View style={styles.nwho}>
          <Avatar k={n.by_key} size={20} />
          <Text style={styles.nwhoName}>{who}</Text>
          <Text style={styles.ntime}>{fmt(n.time_seconds)}</Text>
          {nv < v && !n.done && <Text style={styles.nfrom}>FROM V{nv} · OPEN</Text>}
        </View>
        {n.body ? <Text style={styles.ntxt}>{n.body}</Text> : null}
        <AttChip kind={n.kind} big />
        <NoteExtras n={n} />
        {n.reply_text && (
          <View style={styles.nrep}>
            <Avatar k={n.reply_by_key ?? 'L'} size={18} />
            <Text style={styles.nrepText}>{n.reply_text}</Text>
          </View>
        )}
        {!n.done && (
          <Pressable accessibilityRole="button" onPress={openReply} hitSlop={8}>
            <Text style={styles.nreply}>Reply</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={n.done ? 'Reopen' : 'Mark done'}
        onPress={async () => {
          const done = !n.done;
          await updateNotes(projectId, [n.id], { done });
          if (done) toast('Marked done', () => updateNotes(projectId, [n.id], { done: false }));
        }}
        hitSlop={8}
        style={[styles.circ, n.done && styles.circOn]}>
        {n.done && <Icon name="check" size={16} strokeWidth={2.4} />}
      </Pressable>
    </View>
  );
}

/* ================= ReplySheet ================= */

export function ReplySheet({ projectId, note, onDone }: { projectId: string; note: Note; onDone: () => void }) {
  const { toast } = useOverlay();
  const [text, setText] = useState('');
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <View>
      <View style={styles.noteHead}>
        <Avatar k={note.by_key} size={26} />
        <Text style={styles.noteHeadText}>
          Reply to {note.by_key === 'M' ? 'your note' : person(note.by_key).name} · {fmt(note.time_seconds)}
        </Text>
      </View>
      <View style={styles.quote}>
        <Text style={styles.t15}>{note.body}</Text>
      </View>
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Write a reply"
        placeholderTextColor={Color.meta}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        style={[styles.noteInput, { minHeight: 70, flex: 0 }]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          onPress={async () => {
            const v = text.trim();
            if (!v) return;
            await updateNotes(projectId, [note.id], { reply_text: v, reply_by_key: 'M' });
            onDone();
            toast('Reply sent');
          }}
          style={styles.sendCircle}>
          <Icon name="up" size={22} strokeWidth={2.4} color={Color.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    marginTop: 2,
  },
  t15: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.white,
  },
  att: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3A42',
  },
  attBig: {
    height: 26,
    borderRadius: 14,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  attText: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.text2,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  noteHeadText: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  noteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  noteThumb: {
    width: 46,
    height: 62,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  drawthumb: {
    width: 68,
    aspectRatio: 9 / 16,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  noteInput: {
    flex: 1,
    minHeight: 62,
    backgroundColor: Color.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Color.control,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.white,
    textAlignVertical: 'top',
  },
  noteTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  noteTool: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Color.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    textAlign: 'center',
    marginTop: 10,
  },
  nhead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  nheadTitle: {
    flex: 1,
    fontFamily: Font.bold,
    fontSize: 22,
    lineHeight: 28,
    color: Color.white,
  },
  nseg: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    gap: 3,
    backgroundColor: '#2A2A2E',
  },
  nsegBtn: {
    height: 32,
    borderRadius: 17,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  nsegOn: {
    backgroundColor: Color.white,
  },
  nsegText: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    color: Color.text2,
  },
  nsw: {
    overflow: 'hidden',
  },
  // No red in our palette: Delete is Control grey with a white trash icon.
  ndel: {
    width: 88,
    backgroundColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ndelText: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  extras: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 10,
  },
  nrow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Color.control,
    backgroundColor: Color.surface,
  },
  nt: {
    width: 48,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  pdot: {
    position: 'absolute',
    left: 8,
    bottom: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Color.violet,
    borderWidth: 2,
    borderColor: Color.white,
  },
  ringMark: {
    position: 'absolute',
    left: 8,
    top: 22,
    width: 30,
    height: 22,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Color.violet,
  },
  ntime: {
    fontFamily: Font.mono,
    fontSize: 14,
    lineHeight: 18,
    color: Color.text2,
  },
  ntxt: {
    fontFamily: Font.regular,
    fontSize: 17,
    lineHeight: 24,
    color: Color.white,
    marginTop: 6,
  },
  editBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nsend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 6,
  },
  ntidy: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Color.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ntidyText: {
    fontFamily: Font.display,
    fontSize: 20,
    lineHeight: 25,
    paddingTop: 2,
    letterSpacing: 0.6,
    color: Color.white,
  },
  empty: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    textAlign: 'center',
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  vchip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Color.control,
    marginTop: 4,
    marginBottom: 2,
  },
  vchipText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  nwho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nwhoName: {
    fontFamily: Font.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: Color.white,
  },
  nfrom: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: Color.yellow,
  },
  nrep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#3A3A42',
  },
  nrepText: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 20,
    color: Color.text2,
  },
  nreply: {
    marginTop: 12,
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    color: '#9A9AA2',
  },
  circ: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.meta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circOn: {
    backgroundColor: '#3A3A40',
    borderColor: '#3A3A40',
  },
  ndone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  ndoneText: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    color: Color.text2,
  },
  quote: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Color.control,
    marginBottom: 10,
  },
});
