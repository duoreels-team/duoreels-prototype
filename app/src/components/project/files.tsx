/**
 * The project's Footage, Brief and references, and Versions, as sections that every
 * place uses: project details (⋯), the editor's Footage / Brief buttons, the join
 * page and the Brief page. Real files from Supabase; swipe left to remove (grey).
 */
import { Image, type ImageSource } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { UploadBar } from '@/components/brand/upload-bar';
import { normaliseLink } from '@/components/review/attachments';
import { Color, Font } from '@/constants/brand';
import { addFromLibrary, addLink, dropUpload, isVideoRow, linkSource, removeFile, sizeLabel, useProjectFiles, type FileKind, type FileRow, type Upload } from '@/lib/project-files';
import { editorName } from '@/lib/projects';
import { fmt, shortDate, versionPicture, versionVideoUrl, type Version } from '@/lib/review';
import { loadReview, useReviewData } from '@/lib/review-store';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { signedUrl, useSignedUrl } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

/* ================= full-screen player ================= */

type Media = { kind: 'video'; url: string } | { kind: 'image'; source: ImageSource };

function VideoFull({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

export function MediaViewer({ media, title, onClose }: { media: Media | null; title?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!media} transparent={false} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.viewer}>
        {media?.kind === 'video' && <VideoFull url={media.url} />}
        {media?.kind === 'image' && <Image source={media.source} style={StyleSheet.absoluteFill} contentFit="contain" />}
        <View style={[styles.viewerTop, { top: insets.top + 6 }]}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={styles.viewerClose}>
            <Icon name="close" size={22} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Opens a file: video or picture full screen, links in the browser. */
function useOpenFile() {
  const { toast } = useOverlay();
  const [media, setMedia] = useState<{ m: Media; title: string } | null>(null);
  const open = async (r: FileRow) => {
    if (r.link_url) {
      await WebBrowser.openBrowserAsync(r.link_url);
      return;
    }
    if (!r.file_path) return;
    const url = await signedUrl(r.file_path);
    if (!url) {
      toast("Couldn't open it · check your connection", undefined, false);
      return;
    }
    setMedia({ m: isVideoRow(r) ? { kind: 'video', url } : { kind: 'image', source: { uri: url } }, title: r.title ?? '' });
  };
  const viewer = <MediaViewer media={media?.m ?? null} title={media?.title} onClose={() => setMedia(null)} />;
  return { open, viewer };
}

/* ================= one file row ================= */

function Thumb({ r }: { r: FileRow }) {
  const url = useSignedUrl(r.thumb_path && !r.thumb_path.startsWith('sample:') ? r.thumb_path : null);
  return (
    <View style={styles.thumb}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.thumbIcon}>
          <Icon name={r.link_url ? 'link' : isVideoRow(r) ? 'video' : 'image'} size={20} color={Color.text2} />
        </View>
      )}
      {isVideoRow(r) && !r.link_url && (
        <View style={styles.playDot}>
          <Icon name="play" size={10} color={Color.white} />
        </View>
      )}
    </View>
  );
}

function rowMeta(r: FileRow) {
  if (r.link_url) return `Link · ${linkSource(r.link_url)}`;
  return [r.duration_seconds ? fmt(Number(r.duration_seconds)) : isVideoRow(r) ? 'Video' : 'Picture', sizeLabel(r.size_bytes), shortDate(r.created_at)].filter(Boolean).join(' · ');
}

function FileLine({ r, first, canRemove, onOpen, onRemove }: { r: FileRow; first: boolean; canRemove: boolean; onOpen: () => void; onRemove: () => void }) {
  const row = (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${r.title ?? 'file'}`} onPress={onOpen} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.rowPressed]}>
      <Thumb r={r} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {r.title ?? (r.link_url ? linkSource(r.link_url) : 'File')}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {rowMeta(r)}
        </Text>
      </View>
      <Icon name={r.link_url ? 'link' : 'chev'} size={18} color={Color.meta} />
    </Pressable>
  );
  if (!canRemove) return row;
  return (
    <Swipeable
      friction={1.6}
      rightThreshold={44}
      overshootRight={false}
      renderRightActions={(_p, _t, methods) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove"
          onPress={() => {
            methods.close();
            onRemove();
          }}
          style={styles.remove}>
          <Icon name="trash" size={20} color={Color.white} />
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      )}>
      {row}
    </Swipeable>
  );
}

function UploadLine({ u, first, onDrop }: { u: Upload; first: boolean; onDrop: () => void }) {
  return (
    <View style={[styles.row, !first && styles.rowLine]}>
      <View style={styles.thumb}>{u.thumb ? <Image source={{ uri: u.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.thumbIcon}><ActivityIndicator color={Color.text2} /></View>}</View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {u.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {u.state === 'error' ? u.meta : `Uploading ${Math.round(u.percent)}% · ${u.meta}`}
        </Text>
        <View style={{ marginTop: 6 }}>
          <UploadBar percent={u.percent} uploading={u.state === 'up'} />
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={u.state === 'error' ? 'Clear' : 'Cancel upload'} onPress={onDrop} hitSlop={10}>
        <Icon name="close" size={18} color={Color.meta} />
      </Pressable>
    </View>
  );
}

/* ================= add: Photos or a link ================= */

function AddRow({ projectId, kind }: { projectId: string; kind: FileKind }) {
  const { session, profile } = useAuth();
  const { toast } = useOverlay();
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const me = { id: session?.user.id, name: profile?.name?.trim() || 'You' };
  const label = kind === 'clip' ? '+ Add footage' : '+ Add reference';

  async function fromPhotos() {
    setOpen(false);
    const n = await addFromLibrary(projectId, kind, me);
    if (n) toast(`${n} ${kind === 'clip' ? 'clip' : 'reference'}${n === 1 ? '' : 's'} uploading`, undefined, false);
  }
  async function saveLink() {
    const url = normaliseLink(text);
    if (!url) {
      setBad(true);
      return;
    }
    setText('');
    setLinkOpen(false);
    setOpen(false);
    const err = await addLink(projectId, kind, url, me);
    toast(err ?? 'Link added');
  }

  if (!open) return <BigButton label={label} tone="control" onPress={() => setOpen(true)} style={{ marginTop: 14 }} />;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.chips}>
        <Chip icon="image" label="From Photos" height={36} onPress={fromPhotos} />
        <Chip icon="link" label="Paste a link" height={36} on={linkOpen} onPress={() => setLinkOpen((o) => !o)} />
        <Chip icon="close" height={36} width={52} accessibilityLabel="Cancel" onPress={() => setOpen(false)} />
      </View>
      {linkOpen && (
        <View style={styles.linkRow}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setBad(false);
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={kind === 'clip' ? 'Drive, Dropbox or WeTransfer link' : 'A video or post you like'}
            placeholderTextColor={Color.meta}
            selectionColor={Color.violet}
            keyboardAppearance="dark"
            onSubmitEditing={saveLink}
            style={styles.field}
          />
          <Pressable accessibilityRole="button" onPress={saveLink} style={styles.addBtn}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
      )}
      {bad && <Text style={[styles.meta, { marginTop: 6, color: Color.white }]}>That doesn&apos;t look like a link.</Text>}
    </View>
  );
}

/* ================= Footage ================= */

const SAMPLE_FOOT: (keyof typeof SAMPLE_IMAGES)[] = ['mr', 'c1', 'c3', 'player', 'c2', 'cafe'];

export function FootageSection({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const files = useProjectFiles(projectId);
  const { session } = useAuth();
  const { toast } = useOverlay();
  const { open, viewer } = useOpenFile();
  const rows = files.rows.filter((r) => r.kind === 'clip');
  const ups = files.ups.filter((u) => u.kind === 'clip');
  if (!p) return null;
  const total = rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0);
  const sample = p.is_sample && !rows.length;
  const meta = sample
    ? '6 clips · 1.4 GB · received Oct 12'
    : files.status === 'loading' && !rows.length
      ? 'Loading…'
      : files.status === 'error'
        ? "Couldn't load footage · check your connection"
        : rows.length
          ? [`${rows.length} clip${rows.length === 1 ? '' : 's'}`, sizeLabel(total), `received ${shortDate(rows[0].created_at)}`].filter(Boolean).join(' · ')
          : 'No footage yet.';
  return (
    <View>
      <Text style={[styles.meta, { marginBottom: 10 }]}>{meta}</Text>
      {sample ? (
        <View style={styles.grid3}>
          {SAMPLE_FOOT.map((k, i) => (
            <View key={k} style={styles.reel}>
              <Image source={SAMPLE_IMAGES[k]} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.dur}>
                <Text style={styles.durText}>0:{12 + i * 4}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        (rows.length > 0 || ups.length > 0) && (
          <View style={styles.list}>
            {rows.map((r, i) => (
              <FileLine
                key={r.id}
                r={r}
                first={i === 0}
                canRemove={!!session && r.added_by === session.user.id}
                onOpen={() => open(r)}
                onRemove={async () => {
                  const err = await removeFile(projectId, r);
                  toast(err ?? 'Removed', undefined, false);
                }}
              />
            ))}
            {ups.map((u, i) => (
              <UploadLine key={u.key} u={u} first={!rows.length && i === 0} onDrop={() => dropUpload(projectId, u.key)} />
            ))}
          </View>
        )
      )}
      {rows.some((r) => session && r.added_by === session.user.id) && <Text style={[styles.hint, { marginTop: 8 }]}>Swipe left on a clip to remove it.</Text>}
      <AddRow projectId={projectId} kind="clip" />
      {viewer}
    </View>
  );
}

export function FootageSheet({ projectId }: { projectId: string }) {
  return (
    <View>
      <Text style={[styles.t20, { marginBottom: 4 }]}>Footage</Text>
      <FootageSection projectId={projectId} />
    </View>
  );
}

/* ================= Brief and references ================= */

export function BriefEditor({ projectId, onSaved }: { projectId: string; onSaved?: () => void }) {
  const p = useProject(projectId);
  const { update } = useProjects();
  const { toast } = useOverlay();
  const [brief, setBrief] = useState(p?.brief ?? '');
  const [saving, setSaving] = useState(false);
  if (!p) return null;
  const changed = brief.trim() !== (p.brief ?? '').trim();
  return (
    <View>
      <TextInput
        value={brief}
        onChangeText={setBrief}
        multiline
        style={styles.area}
        selectionColor={Color.violet}
        keyboardAppearance="dark"
        placeholder="What should it feel like? Length, pace, music, captions…"
        placeholderTextColor={Color.meta}
        accessibilityLabel="The brief"
      />
      {changed && (
        <BigButton
          label="Save brief"
          tone="control"
          loading={saving}
          style={{ marginTop: 10 }}
          onPress={async () => {
            setSaving(true);
            const err = await update(projectId, { brief: brief.trim() || null });
            setSaving(false);
            toast(err ?? `Brief saved · ${editorName(p)} sees it`);
            if (!err) onSaved?.();
          }}
        />
      )}
    </View>
  );
}

const SAMPLE_REFS = [
  ['mk1', '1:26', '@sunrisesam', 'pacing'],
  ['mk6', '2:04', '@calmcoffee', 'colour'],
] as const;

export function ReferencesSection({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const files = useProjectFiles(projectId);
  const { session } = useAuth();
  const { toast } = useOverlay();
  const { open, viewer } = useOpenFile();
  const rows = files.rows.filter((r) => r.kind === 'reference');
  const ups = files.ups.filter((u) => u.kind === 'reference');
  if (!p) return null;
  const sample = p.is_sample && !rows.length;
  return (
    <View>
      {sample ? (
        <View style={styles.grid3}>
          {SAMPLE_REFS.map(([k, d, h, what]) => (
            <View key={k}>
              <View style={styles.reel}>
                <Image source={SAMPLE_IMAGES[k]} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.dur}>
                  <Text style={styles.durText}>{d}</Text>
                </View>
              </View>
              <Text style={[styles.rowTitle, { fontSize: 14, marginTop: 6 }]}>{h}</Text>
              <Text style={styles.meta}>{what}</Text>
            </View>
          ))}
        </View>
      ) : rows.length || ups.length ? (
        <View style={styles.list}>
          {rows.map((r, i) => (
            <FileLine
              key={r.id}
              r={r}
              first={i === 0}
              canRemove={!!session && r.added_by === session.user.id}
              onOpen={() => open(r)}
              onRemove={async () => {
                const err = await removeFile(projectId, r);
                toast(err ?? 'Removed', undefined, false);
              }}
            />
          ))}
          {ups.map((u, i) => (
            <UploadLine key={u.key} u={u} first={!rows.length && i === 0} onDrop={() => dropUpload(projectId, u.key)} />
          ))}
        </View>
      ) : (
        <Text style={styles.meta}>{files.status === 'loading' ? 'Loading…' : files.status === 'error' ? "Couldn't load references · check your connection" : 'No references yet.'}</Text>
      )}
      <AddRow projectId={projectId} kind="reference" />
      {viewer}
    </View>
  );
}

export function BriefSheet({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  if (!p) return null;
  return (
    <View>
      <Text style={[styles.t20, { marginBottom: 4 }]}>Brief and references</Text>
      <Text style={styles.lbl}>THE BRIEF</Text>
      <BriefEditor projectId={projectId} />
      <Text style={styles.lbl}>REFERENCES</Text>
      <ReferencesSection projectId={projectId} />
    </View>
  );
}

/* ================= Versions ================= */

function VersionThumb({ v }: { v: Version }) {
  const [src, setSrc] = useState<ImageSource | null>(null);
  useEffect(() => {
    versionPicture(v).then(setSrc);
  }, [v]);
  return <View style={styles.thumb}>{src && <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>;
}

export function VersionsSection({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  const data = useReviewData(projectId);
  const { toast } = useOverlay();
  const [media, setMedia] = useState<{ m: Media; title: string } | null>(null);
  useEffect(() => {
    if (data.status !== 'ready') loadReview(projectId);
  }, [projectId, data.status]);
  if (!p) return null;
  const list = [...data.versions].sort((a, b) => b.number - a.number);
  const cur = p.current_version;
  const watch = async (v: Version) => {
    const url = await versionVideoUrl(v);
    if (url) {
      setMedia({ m: { kind: 'video', url }, title: `v${v.number}` });
      return;
    }
    const pic = await versionPicture(v);
    if (pic) setMedia({ m: { kind: 'image', source: pic }, title: `v${v.number}` });
    else toast("Couldn't open this version · check your connection", undefined, false);
  };
  return (
    <View>
      {list.length ? (
        <View style={styles.list}>
          {list.map((v, i) => {
            const n = data.notes.filter((x) => x.version_id === v.id && x.status === 'sent').length;
            return (
              <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`Watch v${v.number}`} onPress={() => watch(v)} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.rowPressed]}>
                <VersionThumb v={v} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    v{v.number}
                    {v.number === cur ? ' · current' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {shortDate(v.created_at)} · {n} note{n === 1 ? '' : 's'}
                  </Text>
                </View>
                <Icon name="play" size={18} color={Color.meta} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.meta}>{data.status === 'loading' ? 'Loading…' : data.status === 'error' ? "Couldn't load versions · check your connection" : `No versions yet · v1 comes from ${editorName(p)}`}</Text>
      )}
      <MediaViewer media={media?.m ?? null} title={media?.title} onClose={() => setMedia(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  hint: { fontFamily: Font.regular, fontSize: 13, lineHeight: 18, color: Color.meta },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 18, marginBottom: 8 },
  list: { backgroundColor: Color.control, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Color.control },
  rowLine: { borderTopWidth: 1, borderTopColor: '#3A3A42' },
  rowPressed: { backgroundColor: '#34343A' },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  thumb: { width: 44, height: 58, borderRadius: 6, overflow: 'hidden', backgroundColor: Color.surface },
  thumbIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playDot: { position: 'absolute', left: 4, bottom: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  remove: { width: 96, backgroundColor: '#48484E', alignItems: 'center', justifyContent: 'center', gap: 4 },
  removeText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  field: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  area: { minHeight: 110, borderRadius: 12, padding: 14, backgroundColor: Color.control, fontFamily: Font.regular, fontSize: 15, lineHeight: 22, color: Color.white, textAlignVertical: 'top' },
  addBtn: { height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: Color.white, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.black },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reel: { width: 96, aspectRatio: 9 / 13, borderRadius: 8, overflow: 'hidden', backgroundColor: Color.surface },
  dur: { position: 'absolute', left: 4, bottom: 4, height: 20, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  durText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.white },
  viewer: { flex: 1, backgroundColor: Color.black },
  viewerTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewerTitle: { flex: 1, fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  viewerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
