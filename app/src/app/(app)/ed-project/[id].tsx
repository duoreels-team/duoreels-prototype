/**
 * Editor view · Project (prototype V['ed-project'] + edDraw / edNotesSheet / edUploadSheet /
 * uploadV4 / simApprove). Your notes, seen by the editor: tick them, reply, then upload
 * the next version from the photo library (striped progress) or send a link.
 */
import { type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, IconButton, Tag } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { UploadBar } from '@/components/brand/upload-bar';
import { DButton, DecisionBar } from '@/components/review/bars';
import { PathRow } from '@/components/review/project-sheets';
import { Stage, type Clock } from '@/components/review/stage';
import { Strip } from '@/components/review/strip';
import { Color, Font } from '@/constants/brand';
import { saveFileToPhotos } from '@/lib/download';
import { approve, simUpload, type VersionMedia } from '@/lib/flow';
import { usd } from '@/lib/me';
import { editorName, weekday, type Project } from '@/lib/projects';
import { addDays, fmt, money, shortDate, versionPicture, versionVideoUrl, type Note, type Version } from '@/lib/review';
import { currentVersion, loadReview, updateNotes, useReviewData, versionNumber } from '@/lib/review-store';
import { normaliseLink } from '@/components/review/attachments';
import { safeFileName, uploadWithProgress, UploadError, type UploadTask } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

function useMedia(v: Version | null) {
  const [picture, setPicture] = useState<ImageSource | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!v) return;
    versionPicture(v).then((x) => live && setPicture(x));
    versionVideoUrl(v).then((x) => live && setVideoUrl(x));
    return () => {
      live = false;
    };
  }, [v]);
  return { picture: v ? picture : null, videoUrl: v ? videoUrl : null };
}

/* ---------- Maya's notes (edNotesSheet) ---------- */

function EdNotesSheet({ projectId, me, onUpload }: { projectId: string; me: string; onUpload: () => void }) {
  const p = useProject(projectId);
  const data = useReviewData(projectId);
  const [doneOpen, setDoneOpen] = useState(false);
  if (!p) return null;
  const v = p.current_version;
  const ed = p.editor_keys[0] ?? 'L';
  const notes = data.notes.filter((n) => n.by_key === 'M' && n.status === 'sent' && n.kind !== 'pin');
  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);
  const waiting = p.turn === 'me';

  const row = (n: Note) => {
    const nv = versionNumber(data, n.version_id);
    return (
      <View key={n.id} style={[styles.nrow, n.done && { opacity: 0.35 }]}>
        <View style={styles.flex}>
          <View style={styles.nwho}>
            <Avatar k="M" size={20} />
            <Text style={styles.nwhoName}>{me}</Text>
            <Text style={styles.ntime}>{fmt(n.time_seconds)}</Text>
            {nv < v && !n.done && <Text style={styles.nfrom}>FROM V{nv} · OPEN</Text>}
          </View>
          {n.body ? <Text style={styles.ntxt}>{n.body}</Text> : null}
          {n.reply_text && (
            <View style={styles.nrep}>
              <Avatar k={n.reply_by_key ?? ed} size={18} />
              <Text style={styles.nrepText}>{n.reply_text}</Text>
            </View>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={n.done ? 'Reopen' : 'Mark fixed'}
          onPress={() => updateNotes(projectId, [n.id], n.done ? { done: false } : { done: true, reply_text: n.reply_text ?? `Fixed in v${v + 1}.`, reply_by_key: n.reply_by_key ?? ed })}
          hitSlop={8}
          style={[styles.circ, n.done && styles.circOn]}>
          {n.done && <Icon name="check" size={16} strokeWidth={2.4} />}
        </Pressable>
      </View>
    );
  };

  return (
    <View>
      <View style={styles.nhead}>
        <Text style={styles.nheadTitle}>{me}’s notes</Text>
        <Text style={styles.meta}>
          {done.length} of {notes.length} fixed
        </Text>
      </View>
      {open.length ? open.map(row) : <Text style={styles.empty}>All fixed.</Text>}
      {done.length > 0 && (
        <>
          <Pressable accessibilityRole="button" onPress={() => setDoneOpen((o) => !o)} style={styles.ndone}>
            <Text style={styles.ndoneText}>Fixed · {done.length}</Text>
            <View style={{ transform: [{ rotate: doneOpen ? '180deg' : '0deg' }] }}>
              <Icon name="down" size={16} color={Color.text2} />
            </View>
          </Pressable>
          {doneOpen && done.map(row)}
        </>
      )}
      {!waiting && p.status !== 'done' && <BigButton label={`Upload v${v + 1}${open.length ? ` · ${open.length} open` : ''}`} onPress={onUpload} style={{ marginTop: 16 }} />}
    </View>
  );
}

/* ---------- Upload vN (edUploadSheet) ---------- */

function EdUploadSheet({ project, me, open, onPick, onLink }: { project: Project; me: string; open: number; onPick: () => void; onLink: (url: string) => void }) {
  const [linkOpen, setLinkOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const v = project.current_version + 1;
  return (
    <View>
      <Text style={styles.t20}>Upload v{v}</Text>
      <Text style={[styles.meta, { marginBottom: 14 }]}>
        {project.name} · round {v} of {Math.max(project.rounds, v)} · {me} gets it right away
      </Text>
      <Pressable accessibilityRole="button" onPress={onPick} style={({ pressed }) => [styles.drop, pressed && { backgroundColor: Color.surface }]}>
        <Icon name="upload" size={28} strokeWidth={1.6} />
        <Text style={[styles.rowTitle, { fontSize: 16 }]}>Choose from your phone</Text>
        <Text style={styles.meta}>Photos · .mov .mp4</Text>
      </Pressable>
      <Text style={styles.lbl}>OR PASTE A LINK</Text>
      <View style={styles.chips}>
        {['Google Drive', 'Dropbox', 'iCloud Drive', 'WeTransfer', 'Frame.io', 'Any link'].map((n) => (
          <Pressable key={n} accessibilityRole="button" onPress={() => setLinkOpen(n)} style={[styles.chip, linkOpen === n && styles.chipOn]}>
            <Icon name="link" size={14} color={linkOpen === n ? Color.black : Color.white} />
            <Text style={[styles.chipText, linkOpen === n && { color: Color.black }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {linkOpen && (
        <View style={[styles.linkRow, bad && { borderColor: Color.white }]}>
          <TextInput
            autoFocus
            value={text}
            onChangeText={(t) => {
              setText(t);
              setBad(false);
            }}
            placeholder={`Paste the ${linkOpen === 'Any link' ? '' : `${linkOpen} `}link to v${v}`}
            placeholderTextColor={Color.meta}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectionColor={Color.violet}
            keyboardAppearance="dark"
            style={styles.linkInput}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const url = normaliseLink(text);
              if (!url) {
                setBad(true);
                return;
              }
              onLink(url);
            }}
            hitSlop={6}
            style={{ paddingHorizontal: 12, height: 36, justifyContent: 'center' }}>
            <Text style={[styles.lab, { color: Color.violet }]}>Send</Text>
          </Pressable>
        </View>
      )}
      {open > 0 && (
        <View style={styles.hint}>
          <Icon name="spark" size={14} color={Color.violet} />
          <Text style={[styles.meta, styles.flex]}>
            {open} of {me}’s notes aren’t ticked yet. They’ll be marked fixed when you send.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ---------- the uploading overlay (uploadV4) ---------- */

type Pending = { uri: string; name: string; mime: string; seconds: number; size: number | null };

function UploadOverlay({ project, file, me, changes, onCancel, onSent }: { project: Project; file: Pending; me: string; changes: string; onCancel: () => void; onSent: () => void }) {
  const { toast } = useOverlay();
  const [pct, setPct] = useState(0);
  const [path, setPath] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [task] = useState<UploadTask>(() => uploadWithProgress({ path: `${project.id}/versions/${Date.now()}-${safeFileName(file.name)}`, uri: file.uri, name: file.name, mimeType: file.mime, onProgress: setPct }));
  const v = project.current_version + 1;

  useEffect(() => {
    let live = true;
    task.done
      .then(async (p) => {
        if (!live) return;
        setPath(p);
        try {
          const t = await VideoThumbnails.getThumbnailAsync(file.uri, { time: 0, quality: 0.6 });
          const tp = `${project.id}/thumbs/${Date.now()}.jpg`;
          await uploadWithProgress({ path: tp, uri: t.uri, name: 'thumb.jpg', mimeType: 'image/jpeg' }).done;
          if (live) setThumb(tp);
        } catch {
          // no thumbnail; the version still works
        }
      })
      .catch((e: UploadError) => {
        if (!live || e.message === 'Cancelled') return;
        toast(e.tooBig ? 'Too big to upload here · send a link instead' : "Couldn't upload · check your connection");
        onCancel();
      });
    const t = setTimeout(() => live && setText(changes), 1500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [task, file.uri, project.id, changes, onCancel, toast]);

  async function send() {
    if (!path) return;
    setSending(true);
    const media: VersionMedia = { video_path: path, thumb_path: thumb, media_kind: 'video', duration_seconds: file.seconds || project.duration_seconds || 30 };
    const res = await simUpload(project, media, text ?? '');
    setSending(false);
    if (res.error) {
      toast(res.error);
      return;
    }
    onSent();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.ocard}>
          <Text style={styles.upnum}>{pct}%</Text>
          <UploadBar percent={pct} uploading={pct < 100} />
          <Text style={[styles.rowTitle, { fontSize: 16, textAlign: 'center', marginTop: 6 }]}>{pct < 100 ? `Uploading v${v}` : `v${v} is up`}</Text>
          <Text style={[styles.mono, { textAlign: 'center' }]} numberOfLines={1}>
            {file.name} · {fmt(file.seconds)}
            {file.size ? ` · ${Math.max(1, Math.round(file.size / 1e6))} MB` : ''}
          </Text>
          <View style={styles.wcHead}>
            <Text style={[styles.lbl, { marginTop: 0, marginBottom: 0 }]}>WHAT CHANGED</Text>
            <Tag label="Draft" tone="violet" height={22} />
          </View>
          {text === null ? (
            <Text style={[styles.wc, { color: Color.meta }]}>Writing from your ticked notes…</Text>
          ) : (
            <TextInput value={text} onChangeText={setText} multiline placeholder={`Tell ${me} what changed`} placeholderTextColor={Color.meta} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.wc} />
          )}
          <BigButton label={`Send to ${me}`} tone="white" disabled={!path} loading={sending} onPress={send} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              task.cancel();
              onCancel();
            }}
            hitSlop={10}>
            <Text style={[styles.meta, { color: Color.white, textAlign: 'center' }]}>Cancel upload</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- the screen ---------- */

export default function EditorProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const data = useReviewData(id);
  const { profile } = useAuth();
  const { refreshProject } = useProjects();
  const { openSheet, closeSheet, toast, banner } = useOverlay();
  const cur = currentVersion(data);
  const { picture, videoUrl } = useMedia(cur);
  const [t, setT] = useState(3);
  const [clock, setClock] = useState<Clock>({ playing: false, seekNonce: 0, seekTo: 3 });
  const [pending, setPending] = useState<Pending | null>(null);
  const me = profile?.name || 'Your creator';

  useEffect(() => {
    loadReview(id);
  }, [id]);

  const notes = useMemo(() => data.notes.filter((n) => n.by_key === 'M' && n.status === 'sent' && n.kind !== 'pin'), [data.notes]);
  const open = notes.filter((n) => !n.done);
  const pins = useMemo(() => (cur ? notes.filter((n) => n.version_id === cur.id || !n.done).map((n) => ({ t: n.time_seconds, by: 'M' })) : []), [notes, cur]);
  const onTime = useCallback((x: number) => setT(x), []);
  const onEnd = useCallback(() => setClock((c) => ({ ...c, playing: false })), []);

  if (!p) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <IconButton name="back" label="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const v = p.current_version;
  const dur = Math.max(1, Number(cur?.duration_seconds) || p.duration_seconds || 30);
  const waiting = p.turn === 'me' && p.status !== 'done';
  const m = money(p);
  const ed = p.editor_keys[0] ?? 'L';

  const seek = (x: number) => {
    setT(x);
    setClock((c) => ({ playing: false, seekTo: x, seekNonce: c.seekNonce + 1 }));
  };

  async function pickVideo() {
    closeSheet();
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setPending({ uri: a.uri, name: a.fileName ?? `${p!.name.toLowerCase().replace(/[^a-z]+/g, '_')}_v${v + 1}.mov`, mime: a.mimeType ?? 'video/quicktime', seconds: a.duration ? a.duration / 1000 : 0, size: a.fileSize ?? null });
  }

  async function sendLink(url: string) {
    closeSheet();
    const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(url);
    const media: VersionMedia = { video_path: url, thumb_path: p!.cover_image ?? null, media_kind: isVideo ? 'video' : 'image', duration_seconds: p!.duration_seconds || 30 };
    const res = await simUpload(p!, media, `Link: ${url}`);
    if (res.error) {
      toast(res.error);
      return;
    }
    await afterSent(res.v ?? v + 1);
  }

  async function afterSent(nv: number) {
    // Everything still open counts as fixed when you send.
    if (open.length) await updateNotes(id, open.map((n) => n.id), { done: true, reply_text: `Fixed in v${nv}.`, reply_by_key: ed });
    await Promise.all([refreshProject(id), loadReview(id)]);
    toast(`v${nv} sent to ${me}. We’ll tell you when ${me} replies.`);
  }

  const changes = (() => {
    const ticked = notes.filter((n) => n.done && n.body).map((n) => n.body.replace(/[.!?]+$/, ''));
    const all = [...ticked, ...open.filter((n) => n.body).map((n) => n.body.replace(/[.!?]+$/, ''))];
    return all.length ? `${all.slice(0, 4).join('; ')}.` : '';
  })();

  const upload = () => openSheet(<EdUploadSheet project={p} me={me} open={open.length} onPick={pickVideo} onLink={sendLink} />);

  async function saveFootage() {
    const { data: clips } = await supabase.from('footage').select('title, file_path').eq('project_id', id).eq('kind', 'clip').not('file_path', 'is', null);
    const list = (clips as { title: string | null; file_path: string }[]) ?? [];
    if (!list.length) {
      toast(p!.is_sample ? 'Sample project · no real clips to save' : 'No clips to save · the footage came as a link', undefined, false);
      return;
    }
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      toast(`Saving ${i + 1} of ${list.length} clips to Photos`, undefined, false);
      try {
        await saveFileToPhotos(list[i].file_path, list[i].title ?? `clip_${i + 1}.mov`);
        ok += 1;
      } catch (e) {
        if ((e as Error).message === 'permission') {
          toast('Allow Photos in Settings to save clips', undefined, false);
          return;
        }
      }
    }
    toast(`Saved ${ok} clip${ok === 1 ? '' : 's'} to Photos`);
  }

  function briefSheet() {
    openSheet(
      <View>
        <Text style={styles.t20}>Brief</Text>
        <View style={[styles.card, { padding: 14 }]}>
          <Text style={styles.t15}>{p!.brief || 'No brief yet. Ask in a message.'}</Text>
        </View>
      </View>,
    );
  }

  function replySheet() {
    openSheet(<ReplySheet me={me} onSend={async (txt) => {
      closeSheet();
      await supabase.from('messages').insert({ editor_key: ed, from_me: false, body: txt });
      await supabase.from('activity').insert({ project_id: id, by_key: ed, title: `${editorName(p!)} sent a message`, body: txt, action: 'thread', unread: true });
      toast(`Sent to ${me}`);
    }} />);
  }

  function detailsSheet() {
    openSheet(
      <View>
        <Text style={styles.t20}>Project details</Text>
        <PathRow project={p!} />
        <View style={{ gap: 10, marginTop: 14 }}>
          {(
            [
              ['compare', 'Versions', v ? `v${v} current${v > 1 ? ` · v${v - 1}` : ''}${v > 2 ? ' · v1' : ''}` : 'No version yet'],
              ['footage', 'Footage', p!.is_sample ? '6 clips · 2.4 GB' : 'From New project · tap ↓ to save'],
              ['money', 'Money', `${usd(m.now)} earned · ${usd(m.onApproval)} on approval`],
            ] as [IconName, string, string][]
          ).map(([i, title, sub]) => (
            <View key={title} style={[styles.card, styles.row]}>
              <Icon name={i} size={22} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.meta}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>,
    );
  }

  async function demoApprove() {
    const res = await approve(p!);
    if (res.error) {
      toast(res.error);
      return;
    }
    await refreshProject(id);
    banner(
      <>
        <Avatar k="M" size={36} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>
            {me} approved v{v}
          </Text>
          <Text style={styles.meta}>
            {usd(m.onApproval)} is on its way to you · {p!.name}
          </Text>
        </View>
      </>,
      () => {},
    );
    setTimeout(() => toast(`Paid ${usd(m.onApproval)} · arrives ${shortDate(addDays(null, 2))}`), 900);
  }

  let decide: React.ReactNode;
  if (p.status === 'done') decide = <DecisionBar who="M" title={`v${v} is final`} sub={`${usd(m.price)} paid · thanks from ${me}`} />;
  else if (waiting)
    decide = (
      <DecisionBar who="M" title={`v${v} sent to ${me}`} sub={`${usd(m.now)} earned · ${me} is reviewing`}>
        <DButton label="Demo: approve" tone="control" icon="bolt" onPress={demoApprove} />
      </DecisionBar>
    );
  else
    decide = (
      <DecisionBar who="M" title={`${notes.length} notes · ${notes.length - open.length} fixed`} sub={open.length ? `${open.length} open · v${v + 1} due ${weekday(p.due_date)}` : `All fixed · ready for v${v + 1}`}>
        <DButton label={`Upload v${v + 1}`} onPress={upload} />
      </DecisionBar>
    );

  const tools: [IconName, string, () => void, boolean][] = [
    ['upload', 'Upload', upload, waiting || p.status === 'done'],
    ['footage', 'Footage', saveFootage, false],
    ['list', 'Brief', briefSheet, false],
    ['chat', 'Reply', replySheet, false],
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <IconButton name="back" label="Back" onPress={() => router.back()} />
        <View style={styles.flex}>
          <Text style={styles.ttTitle} numberOfLines={1}>
            {p.name}
          </Text>
          <View style={styles.ttSub}>
            <Avatar k="M" size={14} />
            <Text style={styles.ttSubText} numberOfLines={1}>
              {p.status === 'done' ? `Done · v${v} is final` : waiting ? `Waiting on ${me} · v${v} sent` : `Your turn · v${v + 1} due ${weekday(p.due_date)} 6 pm`}
            </Text>
          </View>
        </View>
        <IconButton name="dl" size={22} label="Download footage" onPress={saveFootage} />
        <IconButton name="more" label="Project details" onPress={detailsSheet} />
      </View>

      <View style={styles.player}>
        <Stage kind={!v ? 'empty' : cur?.media_kind === 'video' && videoUrl ? 'video' : 'image'} videoUrl={videoUrl} picture={picture} duration={dur} clock={clock} onTime={onTime} onEnd={onEnd} editorName={editorName(p)}>
          {v > 0 && <Pressable accessibilityLabel="Play or pause" style={StyleSheet.absoluteFill} onPress={() => setClock((c) => ({ ...c, playing: !c.playing }))} />}
          {v > 0 && !clock.playing && (
            <Pressable accessibilityRole="button" accessibilityLabel="Play" onPress={() => setClock((c) => ({ ...c, playing: true }))} style={styles.pbtn}>
              <Icon name="play" size={30} />
            </Pressable>
          )}
        </Stage>
      </View>

      <View style={styles.timerow}>
        <Text style={styles.time}>
          {fmt(t)} / {fmt(dur)}
        </Text>
        <View style={styles.flex} />
        <IconButton name={clock.playing ? 'pause' : 'play'} label="Play" onPress={() => setClock((c) => ({ ...c, playing: !c.playing }))} />
        <View style={styles.vchip}>
          <Text style={styles.lab}>v{Math.max(v, 1)}</Text>
        </View>
      </View>

      <Strip style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 16 }} duration={dur} t={t} frames={v ? { picture, videoUrl } : 'empty'} pins={pins} ranges={[]} range={null} onSeek={seek} onRange={() => {}} />

      {decide}

      <View style={[styles.tools, { paddingBottom: Math.max(28, insets.bottom) }]}>
        {tools.map(([icon, label, onPress, disabled]) => (
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.tl, pressed && { backgroundColor: Color.surface }, disabled && { opacity: 0.3 }]}>
            <Icon name={icon} size={24} strokeWidth={1.6} color="#DDDDDD" />
            <Text style={styles.tlText} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => openSheet(<EdNotesSheet projectId={id} me={me} onUpload={() => { closeSheet(); setTimeout(upload, 420); }} />)} style={styles.notesbtn}>
          <Text style={styles.notesText}>NOTES</Text>
          {open.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{open.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {pending && (
        <UploadOverlay
          project={p}
          file={pending}
          me={me}
          changes={changes}
          onCancel={() => setPending(null)}
          onSent={() => {
            const nv = v + 1;
            setPending(null);
            afterSent(nv);
          }}
        />
      )}
    </View>
  );
}

function ReplySheet({ me, onSend }: { me: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
        <Avatar k="M" size={26} />
        <Text style={styles.rowTitle}>Message {me}</Text>
      </View>
      <TextInput autoFocus value={text} onChangeText={setText} multiline placeholder="Ask about a note, or tell them what changed" placeholderTextColor={Color.meta} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.area} />
      <BigButton label="Send" disabled={!text.trim()} onPress={() => onSend(text.trim())} style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  flex: { flex: 1, minWidth: 0 },
  topbar: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10 },
  ttTitle: { fontFamily: Font.semibold, fontSize: 17, lineHeight: 22, color: Color.white },
  ttSub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  ttSubText: { flex: 1, fontFamily: Font.regular, fontSize: 14, lineHeight: 18, color: Color.meta },
  player: { flex: 1, minHeight: 0, paddingVertical: 4, alignItems: 'center' },
  pbtn: { position: 'absolute', left: '50%', top: '50%', width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  timerow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingLeft: 16, paddingRight: 12 },
  time: { width: 96, fontFamily: Font.mono, fontSize: 13, lineHeight: 18, color: Color.white },
  vchip: { height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: Color.control, justifyContent: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, paddingLeft: 10, paddingRight: 16 },
  tl: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingVertical: 6, borderRadius: 10 },
  tlText: { fontFamily: Font.medium, fontSize: 14, lineHeight: 18, color: '#DDDDDD' },
  notesbtn: { flexShrink: 0, marginLeft: 4, height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.control, flexDirection: 'row', alignItems: 'center', gap: 8 },
  notesText: { fontFamily: Font.display, fontSize: 18, lineHeight: 23, paddingTop: 2, letterSpacing: 0.54, color: Color.white },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Color.violet, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: Font.bold, fontSize: 14, lineHeight: 18, color: Color.black },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 2, marginBottom: 4 },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white },
  lab: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  mono: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18, color: Color.meta },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 18, marginBottom: 8 },
  card: { borderRadius: 12, backgroundColor: Color.control, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  nhead: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 4 },
  nheadTitle: { flex: 1, fontFamily: Font.bold, fontSize: 22, lineHeight: 28, color: Color.white },
  nrow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Color.control },
  nwho: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nwhoName: { fontFamily: Font.semibold, fontSize: 16, lineHeight: 20, color: Color.white },
  ntime: { fontFamily: Font.mono, fontSize: 14, lineHeight: 18, color: Color.text2 },
  nfrom: { fontFamily: Font.bold, fontSize: 14, lineHeight: 18, color: Color.yellow },
  ntxt: { fontFamily: Font.regular, fontSize: 17, lineHeight: 24, color: Color.white, marginTop: 6 },
  nrep: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#3A3A42' },
  nrepText: { flex: 1, fontFamily: Font.regular, fontSize: 15, lineHeight: 20, color: Color.text2 },
  circ: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: Color.meta, alignItems: 'center', justifyContent: 'center' },
  circOn: { backgroundColor: '#3A3A40', borderColor: '#3A3A40' },
  ndone: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  ndoneText: { fontFamily: Font.medium, fontSize: 15, lineHeight: 20, color: Color.text2 },
  empty: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, textAlign: 'center', paddingVertical: 30 },
  drop: { alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#3A3A42' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42' },
  chipOn: { backgroundColor: Color.white, borderColor: Color.white },
  chipText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  linkRow: { flexDirection: 'row', alignItems: 'center', height: 48, marginTop: 12, paddingLeft: 14, paddingRight: 4, borderRadius: 12, backgroundColor: Color.control, borderWidth: 1.5, borderColor: 'transparent' },
  linkInput: { flex: 1, minWidth: 0, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  ocard: { width: 310, padding: 24, borderRadius: 16, gap: 12, backgroundColor: 'rgba(28,28,30,0.96)' },
  upnum: { fontFamily: Font.display, fontSize: 56, lineHeight: 60, paddingTop: 4, textAlign: 'center', color: Color.white },
  wcHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3A3A42' },
  wc: { minHeight: 64, padding: 12, borderRadius: 8, backgroundColor: Color.surface, fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.white, textAlignVertical: 'top' },
  area: { minHeight: 80, padding: 14, borderRadius: 12, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, textAlignVertical: 'top' },
});
