/**
 * New project (prototype V.newproject + np* / voiceBrief / aiBrief / pickEditor / sendInvite).
 *
 * The project is created as a draft the moment you add something, so clips can
 * upload into "project-files/<project id>/…" right away. "Send invite" turns the
 * draft into a real project; closing with ✕ throws the draft away.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, Chip, IconButton } from '@/components/brand/bits';
import { NewTypeSheet } from '@/components/new-project/new-type-sheet';
import { Icon } from '@/components/brand/icons';
import { UploadBar } from '@/components/brand/upload-bar';
import { RecordingBar } from '@/components/review/attachments';
import { transcribeClip, useVoiceRecorder } from '@/lib/voice';
import { InviteSheet, PickEditorSheet, editorFullName } from '@/components/new-project/sheets';
import { FirstCutSheet, PaymentSheet, paymentLabel } from '@/components/new-project/terms-sheets';
import { Color, Font, Space } from '@/constants/brand';
import { defaultFirstCut, firstCutLabel, isoDay } from '@/lib/dates';
import { person } from '@/lib/people';
import { mmss } from '@/lib/projects';
import { fetchTemplates } from '@/lib/templates';
import { UseTemplateSheet } from '@/components/templates/template-sheet';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { removeFiles, safeFileName, uploadWithProgress, UploadError, type UploadTask } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

const TYPES = ['Vlog', 'Food', 'Talking head', 'Product', 'Travel'];
const AI_BRIEF = 'Reels, 30–45 s. Fast cuts, white one-line subtitles, no trending sounds. Start on the coffee.';

type Clip = {
  key: string;
  name: string;
  meta: string;
  thumb: string | number | null; // local uri, or a bundled photo for links
  percent: number;
  state: 'up' | 'done' | 'error';
  footageId?: string;
  paths: string[];
  task?: UploadTask;
};

type Ref = { key: string; thumb: string; paths: string[]; footageId?: string };

const clipIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 20 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(250);

/** A short unique id for clips and references on this screen. */
function newKey(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sizeMB(bytes?: number | null) {
  if (!bytes) return null;
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

function linkSource(v: string) {
  return v.includes('dropbox')
    ? 'Dropbox'
    : v.includes('icloud')
      ? 'iCloud Drive'
      : v.includes('we.tl') || v.includes('wetransfer')
        ? 'WeTransfer'
        : v.includes('f.io') || v.includes('frame.io')
          ? 'Frame.io'
          : v.includes('drive.google')
            ? 'Google Drive'
            : 'Link';
}

async function videoThumb(uri: string) {
  try {
    return (await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.6 })).uri;
  } catch {
    return null;
  }
}

export default function NewProjectScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editor?: string }>();
  const { session, profile, reloadProfile } = useAuth();
  const { projects, reload } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();

  const defaultName = useMemo(() => {
    let k = 1;
    while (projects.some((p) => p.name === `Project ${k}`)) k++;
    return `Project ${k}`;
    // Only when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(defaultName);
  const [type, setType] = useState('Vlog');
  const myTypes = profile?.my_types ?? [];
  const [brief, setBrief] = useState('');
  const [editor, setEditor] = useState(params.editor && /^[A-Z]$/.test(params.editor) ? params.editor : 'L');
  const [price, setPrice] = useState(75);
  const [rounds, setRounds] = useState(3);
  const [firstCut, setFirstCut] = useState(defaultFirstCut);
  const [upfront, setUpfront] = useState(50);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [link, setLink] = useState('');
  const [briefVoice, setBriefVoice] = useState<'idle' | 'hearing' | 'notHeard'>('idle');
  const [sending, setSending] = useState(false);

  const draftId = useRef<Promise<string> | null>(null);
  const sent = useRef(false);
  const inviteMade = useRef(false);
  const linkInput = useRef<TextInputInstance>(null);
  const mic = useVoiceRecorder();
  const listening = mic.recording;

  const ed = person(editor).name;
  const okFoot = clips.length > 0;

  /* ---------- the draft project in Supabase ---------- */

  function ensureDraft() {
    if (!draftId.current) {
      draftId.current = (async () => {
        const { data, error } = await supabase
          .from('projects')
          .insert({ name: name.trim() || 'Project 1', type, is_draft: true, editor_keys: [editor], rounds, price })
          .select('id')
          .single();
        if (error || !data) {
          draftId.current = null;
          throw error ?? new Error('No draft');
        }
        return data.id as string;
      })();
    }
    return draftId.current;
  }

  // ✕ without sending: throw the draft (and its files) away.
  useEffect(() => {
    return () => {
      if (sent.current || !draftId.current) return;
      draftId.current
        .then(async (id) => {
          const { data } = await supabase.from('footage').select('file_path, thumb_path').eq('project_id', id);
          await removeFiles((data ?? []).flatMap((f) => [f.file_path, f.thumb_path]));
          await supabase.from('projects').delete().eq('id', id);
        })
        .catch(() => {});
    };
  }, []);

  const patchClip = (key: string, fields: Partial<Clip>) => setClips((list) => list.map((c) => (c.key === key ? { ...c, ...fields } : c)));

  /* ---------- Upload from this phone (npUpload) ---------- */

  async function npUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos', 'images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;

    for (const asset of result.assets) {
      const key = newKey('c');
      const isVideo = asset.type === 'video';
      const fileName = asset.fileName ?? `${isVideo ? 'VIDEO' : 'IMG'}_${key.slice(-6)}.${isVideo ? 'MOV' : 'JPG'}`;
      const mimeType = asset.mimeType ?? (isVideo ? 'video/quicktime' : 'image/jpeg');
      const size = sizeMB(asset.fileSize);
      const meta = [isVideo && asset.duration ? mmss(asset.duration / 1000) : null, size, 'from phone'].filter(Boolean).join(' · ');

      setClips((list) => [...list, { key, name: fileName, meta, thumb: isVideo ? null : asset.uri, percent: 0, state: 'up', paths: [] }]);
      startClipUpload({ key, asset, fileName, mimeType, meta, isVideo });
    }
  }

  async function startClipUpload(o: { key: string; asset: ImagePicker.ImagePickerAsset; fileName: string; mimeType: string; meta: string; isVideo: boolean }) {
    let thumbUri: string | null = o.isVideo ? null : o.asset.uri;
    if (o.isVideo) {
      thumbUri = await videoThumb(o.asset.uri);
      patchClip(o.key, { thumb: thumbUri });
    }
    try {
      const pid = await ensureDraft();
      const path = `${pid}/footage/${Date.now()}-${safeFileName(o.fileName)}`;
      const task = uploadWithProgress({ path, uri: o.asset.uri, name: o.fileName, mimeType: o.mimeType, onProgress: (percent) => patchClip(o.key, { percent }) });
      patchClip(o.key, { task, paths: [path] });
      await task.done;

      let thumbPath: string | null = o.isVideo ? null : path;
      if (o.isVideo && thumbUri) {
        thumbPath = `${pid}/thumbs/${Date.now()}.jpg`;
        await uploadWithProgress({ path: thumbPath, uri: thumbUri, name: 'thumb.jpg', mimeType: 'image/jpeg' }).done.catch(() => (thumbPath = null));
      }

      const { data, error } = await supabase
        .from('footage')
        .insert({
          project_id: pid,
          title: o.fileName,
          file_path: path,
          kind: 'clip',
          size_bytes: o.asset.fileSize ?? null,
          duration_seconds: o.asset.duration ? o.asset.duration / 1000 : null,
          mime_type: o.mimeType,
          thumb_path: thumbPath,
          added_by: session?.user.id,
        })
        .select('id')
        .single();
      if (error) throw error;
      patchClip(o.key, { state: 'done', percent: 100, footageId: data.id, paths: [path, thumbPath].filter(Boolean) as string[], task: undefined });
    } catch (e) {
      if (e instanceof UploadError && e.message === 'Cancelled') return;
      const tooBig = e instanceof UploadError && e.tooBig;
      patchClip(o.key, {
        state: 'error',
        task: undefined,
        meta: tooBig ? "Too big to upload here · try a shorter clip or a link" : "Couldn't upload · check your connection",
      });
    }
  }

  /* ---------- ✕ on a clip (npDelClip) ---------- */

  async function npDelClip(clip: Clip) {
    clip.task?.cancel();
    setClips((list) => list.filter((c) => c.key !== clip.key));
    if (clip.footageId) await supabase.from('footage').delete().eq('id', clip.footageId);
    await removeFiles(clip.paths.filter((p) => !p.startsWith('sample:')));
  }

  /* ---------- Or paste a link (npPaste) ---------- */

  async function npPaste() {
    const v = link.trim();
    if (!v) {
      linkInput.current?.focus();
      return;
    }
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const d = linkSource(url);
    const key = newKey('c');
    setClips((list) => [...list, { key, name: `${d} folder`, meta: `from ${d}`, thumb: SAMPLE_IMAGES.s23, percent: 0, state: 'up', paths: [] }]);
    setLink('');
    patchClip(key, { percent: 30 });
    try {
      const pid = await ensureDraft();
      patchClip(key, { percent: 70 });
      const { data, error } = await supabase
        .from('footage')
        .insert({ project_id: pid, title: `${d} folder`, link_url: url, kind: 'clip', added_by: session?.user.id })
        .select('id')
        .single();
      if (error) throw error;
      patchClip(key, { state: 'done', percent: 100, footageId: data.id });
    } catch {
      patchClip(key, { state: 'error', meta: "Couldn't save the link · check your connection" });
    }
  }

  /* ---------- References (npRef) ---------- */

  async function npRef() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.9 });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const key = newKey('r');
      const isVideo = asset.type === 'video';
      const thumb = isVideo ? await videoThumb(asset.uri) : asset.uri;
      if (!thumb) continue;
      setRefs((list) => [...list, { key, thumb, paths: [] }]);
      (async () => {
        const pid = await ensureDraft();
        const fileName = asset.fileName ?? `${key}.${isVideo ? 'mov' : 'jpg'}`;
        const mimeType = asset.mimeType ?? (isVideo ? 'video/quicktime' : 'image/jpeg');
        const path = `${pid}/references/${Date.now()}-${safeFileName(fileName)}`;
        await uploadWithProgress({ path, uri: asset.uri, name: fileName, mimeType }).done;
        const { data, error } = await supabase
          .from('footage')
          .insert({ project_id: pid, title: fileName, file_path: path, kind: 'reference', mime_type: mimeType, size_bytes: asset.fileSize ?? null, added_by: session?.user.id })
          .select('id')
          .single();
        if (error) throw error;
        setRefs((list) => list.map((r) => (r.key === key ? { ...r, paths: [path], footageId: data.id } : r)));
      })().catch(() => {
        setRefs((list) => list.filter((r) => r.key !== key));
        toast("Couldn't add that reference. Try again.", undefined);
      });
    }
  }

  /* ---------- Brief: AI (aiBrief) and voice (voiceBrief) ---------- */

  async function aiBrief() {
    for (let i = 0; i <= AI_BRIEF.length; i += 2) {
      setBrief(AI_BRIEF.slice(0, i));
      await sleep(14);
    }
    setBrief(AI_BRIEF);
  }

  async function voiceBrief() {
    if (briefVoice === 'hearing') return;
    if (!listening) {
      setBriefVoice('idle');
      await mic.start();
      return;
    }
    // Second tap: stop, keep the recording with the project, turn it into the brief text.
    const clip = await mic.stop();
    if (!clip) {
      setBriefVoice('notHeard');
      return;
    }
    setBriefVoice('hearing');
    let pid: string;
    try {
      pid = await ensureDraft();
    } catch {
      setBriefVoice('notHeard');
      return;
    }
    const { path, segments } = await transcribeClip(clip.uri, `${pid}/voice`);
    if (path) await supabase.from('projects').update({ brief_audio_path: path }).eq('id', pid);
    const said = (segments ?? []).map((x) => x.text.trim()).join(' ').trim();
    if (!said) {
      setBriefVoice('notHeard');
      return;
    }
    // Into the brief field, where you can edit it.
    setBrief((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said));
    setBriefVoice('idle');
  }

  /* ---------- Who edits? (pickEditor / setEd / shareLink) ---------- */

  function pickEditor() {
    openSheet(
      <PickEditorSheet
        selected={editor}
        onPick={(k) => {
          setEditor(k);
          closeSheet();
        }}
        onShareLink={async () => {
          closeSheet();
          try {
            const pid = await ensureDraft();
            const { data, error } = await supabase
              .from('invites')
              .insert({ project_id: pid, editor_key: editor, invited_by: session?.user.id, status: 'pending' })
              .select('code')
              .single();
            if (error) throw error;
            inviteMade.current = true;
            openSheet(<InviteSheet editorName={ed} projectName={name} code={data.code} onDone={closeSheet} onCopied={() => toast('Link copied')} />);
          } catch {
            toast("Couldn't make the link · check your connection", undefined);
          }
        }}
        onMarketplace={() => {
          closeSheet();
          router.navigate('/market');
        }}
      />,
    );
  }

  /* ---------- + New type (prototype npNewType / npNewTypeAdd) ---------- */

  function newType() {
    openSheet(
      <NewTypeSheet
        onAdd={async (v) => {
          closeSheet();
          setType(v);
          if (!TYPES.includes(v) && !myTypes.includes(v) && session) {
            await supabase.from('profiles').update({ my_types: [...myTypes, v] }).eq('id', session.user.id);
            reloadProfile();
          }
          toast(`Added “${v}”`);
        }}
      />,
    );
  }

  /* ---------- Use a template (NEW) ---------- */

  async function useTemplate() {
    const { list } = await fetchTemplates();
    openSheet(
      <UseTemplateSheet
        list={list}
        onPick={(tpl) => {
          closeSheet();
          setBrief(tpl.brief);
          if (TYPES.includes(tpl.type)) setType(tpl.type);
          toast(`Brief from ${tpl.title}`);
        }}
        onManage={() => {
          closeSheet();
          router.push('/templates');
        }}
      />,
    );
  }

  /* ---------- First cut + Payment ---------- */

  // If the draft already exists, save straight away; otherwise it's saved with "Send invite".
  async function saveOnDraft(fields: Record<string, unknown>) {
    if (!draftId.current) return;
    try {
      const pid = await draftId.current;
      await supabase.from('projects').update(fields).eq('id', pid);
    } catch {
      // Saved again on Send invite.
    }
  }

  function openFirstCut() {
    openSheet(
      <FirstCutSheet
        initial={firstCut}
        onDone={(d) => {
          setFirstCut(d);
          closeSheet();
          saveOnDraft({ first_cut_at: d.toISOString(), due_date: isoDay(d) });
        }}
      />,
    );
  }

  function openPayment() {
    openSheet(
      <PaymentSheet
        price={price}
        initial={upfront}
        onDone={(up) => {
          setUpfront(up);
          closeSheet();
          saveOnDraft({ upfront_percent: up });
        }}
      />,
    );
  }

  /* ---------- Send invite (sendInvite) ---------- */

  async function sendInvite() {
    if (!clips.length) {
      toast('Add your footage first');
      return;
    }
    setSending(true);
    try {
      const pid = await ensureDraft();
      const firstClip = await supabase
        .from('footage')
        .select('thumb_path')
        .eq('project_id', pid)
        .eq('kind', 'clip')
        .not('thumb_path', 'is', null)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      const { error } = await supabase
        .from('projects')
        .update({
          name: name.trim() || 'Project 1',
          type,
          brief: brief.trim() || null,
          is_draft: false,
          status: 'in_progress',
          round: 1,
          rounds,
          current_version: 0,
          turn: 'them',
          first_cut_at: firstCut.toISOString(),
          due_date: isoDay(firstCut),
          upfront_percent: upfront,
          price,
          editor_keys: [editor],
          duration_seconds: 30,
          cover_image: firstClip.data?.thumb_path ?? 'sample:s23',
        })
        .eq('id', pid);
      if (error) throw error;
      if (!inviteMade.current) {
        const invite = await supabase.from('invites').insert({ project_id: pid, editor_key: editor, invited_by: session?.user.id, status: 'pending' });
        if (invite.error) throw invite.error;
      }
      sent.current = true;
      await reload();
      router.replace(`/project/${pid}`);
      setTimeout(() => toast(`Invite sent to ${ed} · footage shared`), 420);
    } catch {
      setSending(false);
      toast("Couldn't send the invite · check your connection", undefined);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
          <View style={styles.topbar}>
            <IconButton name="close" label="Close" onPress={() => router.back()} />
            <Text style={styles.topTitle}>New project</Text>
          </View>

          <View style={styles.pad}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name it, e.g. Morning routine"
              placeholderTextColor={Color.meta}
              accessibilityLabel="Project name"
              selectionColor={Color.violet}
              keyboardAppearance="dark"
              style={styles.nameInput}
            />

            <Text style={styles.lbl}>FOOTAGE</Text>
            {clips.map((c) => (
              <Animated.View key={c.key} entering={clipIn} style={styles.clip}>
                <View style={styles.clipThumb}>{c.thumb !== null && <Image source={typeof c.thumb === 'string' ? { uri: c.thumb } : c.thumb} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
                <View style={styles.flex}>
                  <Text style={styles.lab} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {c.state === 'up' ? `Uploading · ${c.percent}%` : c.meta}
                  </Text>
                  <UploadBar percent={c.state === 'error' ? c.percent : c.percent} uploading={c.state === 'up'} />
                </View>
                <IconButton name="close" label="Remove" size={18} color={Color.text2} width={30} onPress={() => npDelClip(c)} style={{ height: 30 }} />
              </Animated.View>
            ))}

            <Pressable accessibilityRole="button" onPress={npUpload} style={({ pressed }) => [styles.upl, pressed && styles.pressed]}>
              <Icon name="up" size={22} strokeWidth={2} />
              <View>
                <Text style={styles.lab}>Upload from this phone</Text>
                <Text style={styles.meta}>Videos and photos from your camera roll</Text>
              </View>
            </Pressable>

            <View style={styles.plink}>
              <Icon name="link" size={18} color={Color.text2} />
              <TextInput
                ref={linkInput}
                value={link}
                onChangeText={setLink}
                placeholder="Or paste a link"
                placeholderTextColor={Color.meta}
                accessibilityLabel="Paste a link to your clips"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={npPaste}
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                style={styles.plinkInput}
              />
              <Pressable accessibilityRole="button" onPress={npPaste} hitSlop={6} style={styles.plinkBtn}>
                <Text style={[styles.lab, { color: Color.violet }]}>Add</Text>
              </Pressable>
            </View>

            <Text style={styles.lbl}>TYPE · USED BY FILTER</Text>
            <View style={styles.chips}>
              {[...TYPES, ...myTypes].map((t) => (
                <Chip key={t} label={t} on={type === t} onPress={() => setType(t)} />
              ))}
              <Chip label="+ New type" onPress={newType} />
            </View>

            <Text style={styles.lbl}>THE BRIEF</Text>
            <View>
              <TextInput
                value={brief}
                onChangeText={setBrief}
                multiline
                placeholder="What should it feel like? Length, pace, music, captions…"
                placeholderTextColor={Color.meta}
                accessibilityLabel="The brief"
                selectionColor={Color.violet}
                keyboardAppearance="dark"
                style={styles.briefInput}
              />
              <View style={styles.briefTools}>
                <IconButton
                  name="mic"
                  label={listening ? 'Stop and use this' : 'Speak your brief'}
                  size={18}
                  width={34}
                  color={listening ? Color.violet : Color.white}
                  onPress={voiceBrief}
                  style={{ height: 34 }}
                />
                <IconButton name="spark" label="Write with AI" size={18} width={34} color={Color.violet} onPress={aiBrief} style={{ height: 34 }} />
              </View>
            </View>
            {listening && (
              <View style={{ marginTop: 10 }}>
                <RecordingBar seconds={mic.seconds} levels={mic.levels} onStop={voiceBrief} />
              </View>
            )}
            {briefVoice === 'hearing' && (
              <View style={styles.voiceLine}>
                <ActivityIndicator size="small" color={Color.violet} />
                <Text style={styles.meta}>Turning your voice into text…</Text>
              </View>
            )}
            {briefVoice === 'notHeard' && !listening && (
              <Pressable accessibilityRole="button" onPress={voiceBrief} style={styles.voiceLine}>
                <Icon name="mic" size={16} color={Color.meta} />
                <Text style={styles.meta}>
                  Couldn&apos;t hear anything · <Text style={{ color: Color.violet }}>Try again</Text>
                </Text>
              </Pressable>
            )}
            {mic.micSheet}

            {/* NEW · fill the brief from one of your saved templates */}
            <Pressable accessibilityRole="button" onPress={useTemplate} style={({ pressed }) => [styles.templateRow, pressed && styles.rowPressed]}>
              <Icon name="doc" size={18} color={Color.text2} />
              <Text style={[styles.lab, styles.flex]}>Use a template</Text>
              <Icon name="chev" size={16} />
            </Pressable>

            <Text style={styles.lbl}>REFERENCES</Text>
            <View style={styles.refs}>
              {refs.map((r) => (
                <View key={r.key} style={styles.reel}>
                  <Image source={{ uri: r.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={npRef} style={({ pressed }) => [styles.addRef, pressed && styles.pressed]}>
                <Icon name="plus" size={20} color={Color.text2} />
                <Text style={styles.addRefText}>Add a link</Text>
              </Pressable>
            </View>

            <Text style={styles.lbl}>DETAILS</Text>
            <View style={styles.list}>
              <Pressable accessibilityRole="button" onPress={pickEditor} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={[styles.rowText, styles.flex]}>Editor</Text>
                <Avatar k={editor} size={22} />
                <Text style={styles.lab}>{editorFullName(editor)}</Text>
                <Icon name="chev" size={16} />
              </Pressable>
              <View style={[styles.row, styles.rowLine]}>
                <Text style={[styles.rowText, styles.flex]}>
                  Price <Text style={styles.meta}>fair $50–150</Text>
                </Text>
                <Stepper label="Lower the price" icon="minus" onPress={() => setPrice((v) => Math.max(25, v - 5))} />
                <Text style={styles.stepValue}>${price}</Text>
                <Stepper label="Raise the price" icon="plus" onPress={() => setPrice((v) => v + 5)} />
              </View>
              <View style={[styles.row, styles.rowLine]}>
                <Text style={[styles.rowText, styles.flex]}>Rounds</Text>
                <Stepper label="Fewer rounds" icon="minus" onPress={() => setRounds((v) => Math.max(1, v - 1))} />
                <Text style={styles.stepValue}>{rounds}</Text>
                <Stepper label="More rounds" icon="plus" onPress={() => setRounds((v) => Math.min(5, v + 1))} />
              </View>
              <Pressable accessibilityRole="button" onPress={openFirstCut} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
                <Text style={[styles.rowText, styles.flex]}>First cut</Text>
                <Text style={styles.lab}>{firstCutLabel(firstCut)}</Text>
                <Icon name="chev" size={16} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={openPayment} style={({ pressed }) => [styles.row, styles.rowLine, pressed && styles.rowPressed]}>
                <Text style={[styles.rowText, styles.flex]}>Payment</Text>
                <Text style={styles.lab}>{paymentLabel(upfront)}</Text>
                <Icon name="chev" size={16} />
              </Pressable>
            </View>

            <Text style={styles.fee}>Service fee 5% · nothing is charged until {ed} accepts</Text>

            <BigButton label={okFoot ? `Send invite to ${ed}` : 'Add footage to continue'} disabled={!okFoot} loading={sending} onPress={sendInvite} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Stepper({ icon, label, onPress }: { icon: 'plus' | 'minus'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={7} style={({ pressed }) => [styles.stepper, pressed && { backgroundColor: Color.controlPressed }]}>
      <Icon name={icon} size={16} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  voiceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 6 },
  screen: {
    flex: 1,
    backgroundColor: Color.black,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pad: {
    paddingHorizontal: Space.screenEdge,
  },
  topbar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
  },
  topTitle: {
    fontFamily: Font.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: Color.white,
  },
  nameInput: {
    fontFamily: Font.bold,
    fontSize: 24,
    color: Color.white,
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: Color.control,
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
  lab: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
  clip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Color.surface,
    marginTop: 8,
  },
  clipThumb: {
    width: 40,
    height: 54,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  upl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3A3A42',
    backgroundColor: Color.surface,
    marginTop: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  plink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    marginTop: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 12,
    backgroundColor: Color.surface,
  },
  plinkInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: Font.regular,
    fontSize: 15,
    color: Color.white,
  },
  plinkBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A42',
    justifyContent: 'center',
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
  briefInput: {
    minHeight: 92,
    backgroundColor: Color.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 48,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Color.white,
    textAlignVertical: 'top',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: Color.surface,
  },
  briefTools: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 6,
  },
  refs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reel: {
    width: 84,
    aspectRatio: 9 / 13,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Color.surface,
  },
  addRef: {
    width: 84,
    aspectRatio: 9 / 13,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3A3A42',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addRefText: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.text2,
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
  rowText: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  stepper: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    width: 44,
    textAlign: 'center',
    fontFamily: Font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
  },
  fee: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
});
