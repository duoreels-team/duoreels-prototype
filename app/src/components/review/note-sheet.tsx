/**
 * Add / edit one note (prototype addNoteAt + saveNote), with every tool working:
 *  • Draw  — draws on the current frame (the screen opens draw mode, then comes back here)
 *  • Voice — records with the mic, plays back, and fills the text if "transcribe" is set up
 *  • Image — from Photos or Files; tap to see it full screen; remove before saving
 *  • Link  — type or paste, checked, shown as a chip that opens it
 *  • AI    — tidies what you typed (it never writes a note for you)
 * Everything is uploaded to "project-files/<project id>/notes/…" and saved on the note.
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Image, type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { Avatar, Chip } from '@/components/brand/bits';
import { Icon, type IconName } from '@/components/brand/icons';
import { AttachedImage, AudioChip, LinkChip, normaliseLink, RecordingBar } from '@/components/review/attachments';
import { DrawingOverlay } from '@/components/review/draw-layer';
import { Color, Font } from '@/constants/brand';
import { editorName } from '@/lib/projects';
import { fmt, type Note, type NoteKind } from '@/lib/review';
import { addNote, currentVersion, updateNotes, useReviewData } from '@/lib/review-store';
import { safeFileName, uploadWithProgress } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject } from '@/providers/projects-provider';

type NewFile = { uri: string; mimeType: string; name: string };

/** What you've put in the sheet so far — kept while you go off to draw. */
export type NoteDraft = {
  text: string;
  image: NewFile | { path: string } | null;
  link: string | null;
  voice: { uri?: string; path?: string; seconds: number } | null;
};

export type Drawing = { svg: string | null; pngUri: string | null; path?: string | null };

const ATT: Partial<Record<NoteKind, [IconName, string]>> = { draw: ['pen', 'Drawing'], voice: ['mic', 'Voice'], range: ['range', 'Range'], image: ['image', 'Image'] };

export function NoteSheet({
  projectId,
  t,
  b,
  kind = 'text',
  drawing,
  draft,
  picture,
  edit,
  onSaved,
  onDraw,
}: {
  projectId: string;
  t: number;
  b?: number | null;
  kind?: NoteKind;
  drawing?: Drawing | null;
  draft?: NoteDraft | null;
  picture: ImageSource | null;
  edit?: Note;
  onSaved: (t: number) => void;
  /** Leave the sheet to draw on the frame; the screen brings you back with the drawing. */
  onDraw: (draft: NoteDraft) => void;
}) {
  const project = useProject(projectId);
  const data = useReviewData(projectId);
  const { closeSheet, toast } = useOverlay();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const input = useRef<TextInputInstance>(null);
  const linkInput = useRef<TextInputInstance>(null);

  const [text, setText] = useState(draft?.text ?? edit?.body ?? '');
  const [image, setImage] = useState<NoteDraft['image']>(draft?.image ?? (edit?.image_path ? { path: edit.image_path } : null));
  const [link, setLink] = useState<string | null>(draft?.link ?? edit?.link_url ?? null);
  const [voice, setVoice] = useState<NoteDraft['voice']>(draft?.voice ?? (edit?.audio_path ? { path: edit.audio_path, seconds: 0 } : null));
  const [draw] = useState<Drawing | null>(drawing ?? (edit && (edit.drawing_path || edit.drawing_svg) ? { svg: edit.drawing_svg, pngUri: null, path: edit.drawing_path } : null));
  const [imageMenu, setImageMenu] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [saving, setSaving] = useState(false);

  const rangeEnd = b ?? edit?.end_seconds ?? null;
  const time = edit ? edit.time_seconds : t;
  const ed = project ? editorName(project) : 'your editor';

  useEffect(() => {
    if (draft || drawing) return;
    const timer = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [draft, drawing]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const hasDrawing = !!(draw && (draw.svg || draw.pngUri || draw.path));
  const canSave = !saving && !recording && (text.trim().length > 0 || hasDrawing || !!image || !!voice || !!link);
  const noteKind: NoteKind = hasDrawing ? 'draw' : rangeEnd ? 'range' : edit?.kind && edit.kind !== 'text' ? edit.kind : voice ? 'voice' : image ? 'image' : kind;
  const chip = ATT[noteKind];

  /* ---------- voice ---------- */

  async function startRecording() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      toast('Allow the microphone in Settings to record a voice note', undefined, false);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecSecs(0);
    setRecording(true);
  }

  async function stopRecording() {
    setRecording(false);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri) return;
    setVoice({ uri, seconds: recSecs });
    // Upload now so the clip can be transcribed; the text lands in the box for you to edit.
    try {
      const path = `${projectId}/notes/${Date.now()}-${safeFileName('voice.m4a')}`;
      await uploadWithProgress({ path, uri, name: 'voice.m4a', mimeType: 'audio/mp4' }).done;
      setVoice({ uri, path, seconds: recSecs });
      setHearing(true);
      const { data: out, error } = await supabase.functions.invoke<{ text: string }>('transcribe', { body: { path } });
      setHearing(false);
      const said = out?.text?.trim();
      if (!error && said) setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said));
    } catch {
      setHearing(false);
      // Kept as a voice clip; it uploads again when you save.
    }
  }

  /* ---------- picture ---------- */

  async function fromPhotos() {
    setImageMenu(false);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' });
  }

  async function fromFiles() {
    setImageMenu(false);
    const r = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.name ?? 'image.jpg' });
  }

  /* ---------- link ---------- */

  function toggleLinkBox() {
    setLinkOpen((o) => !o);
  }

  function addLink() {
    const url = normaliseLink(linkText);
    if (!url) {
      setLinkError(true);
      return;
    }
    setLink(url);
    setLinkText('');
    setLinkError(false);
    setLinkOpen(false);
  }

  /* ---------- save ---------- */

  async function upload(file: NewFile, label: string) {
    const path = `${projectId}/notes/${Date.now()}-${safeFileName(file.name || label)}`;
    await uploadWithProgress({ path, uri: file.uri, name: file.name || label, mimeType: file.mimeType }).done;
    return path;
  }

  async function save() {
    if (!canSave) return;
    const cur = currentVersion(data);
    if (!cur && !edit) return;
    setSaving(true);
    try {
      const imagePath = image ? ('path' in image ? image.path : await upload(image, 'image.jpg')) : null;
      const audioPath = voice ? (voice.path ?? (voice.uri ? await upload({ uri: voice.uri, mimeType: 'audio/mp4', name: 'voice.m4a' }, 'voice.m4a') : null)) : null;
      const drawingPath = draw ? (draw.path ?? (draw.pngUri ? await upload({ uri: draw.pngUri, mimeType: 'image/png', name: 'drawing.png' }, 'drawing.png') : null)) : null;
      const fields = {
        body: text.trim(),
        kind: noteKind,
        image_path: imagePath,
        link_url: link,
        audio_path: audioPath,
        drawing_path: drawingPath,
        drawing_svg: draw?.svg ?? null,
      };
      if (edit) {
        await updateNotes(projectId, [edit.id], fields);
        closeSheet();
        toast('Note saved');
        return;
      }
      const note = await addNote(projectId, { version_id: cur!.id, time_seconds: t, end_seconds: rangeEnd, ...fields });
      if (!note) throw new Error('note');
      closeSheet();
      onSaved(t);
    } catch {
      setSaving(false);
      toast("Couldn't save the note · check your connection");
    }
  }

  const tools: [IconName, string, () => void, boolean][] = [
    ['pen', 'Draw on the frame', () => onDraw({ text, image, link, voice }), hasDrawing],
    ['mic', recording ? 'Stop recording' : 'Record a voice note', () => (recording ? stopRecording() : startRecording()), recording || !!voice],
    ['image', 'Add a picture', () => setImageMenu((o) => !o), imageMenu || !!image],
    ['link', 'Add a link', toggleLinkBox, linkOpen || !!link],
  ];

  return (
    <View>
      <View style={styles.head}>
        <Avatar k="M" size={26} />
        <Text style={[styles.headText, styles.flex]}>
          {edit ? 'Edit note · ' : 'Note at '}
          {fmt(time)}
          {rangeEnd ? ` – ${fmt(rangeEnd)}` : ''}
        </Text>
        {chip && (
          <View style={styles.att}>
            <Icon name={chip[0]} size={12} color={Color.text2} />
            <Text style={styles.attText}>{chip[1]}</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        {hasDrawing ? (
          <View style={styles.drawthumb}>
            {picture && <Image source={picture} style={StyleSheet.absoluteFill} contentFit="cover" />}
            {draw?.pngUri ? <Image source={{ uri: draw.pngUri }} style={StyleSheet.absoluteFill} contentFit="fill" /> : draw?.svg ? <DrawingOverlay svg={draw.svg} /> : null}
          </View>
        ) : (
          <View style={styles.thumb}>{picture && <Image source={picture} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
        )}
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          multiline
          placeholder={hasDrawing ? 'Say what the drawing means…' : rangeEnd ? 'What should change in this part?' : 'What should change here?'}
          placeholderTextColor={Color.meta}
          selectionColor={Color.violet}
          keyboardAppearance="dark"
          style={styles.input}
        />
      </View>

      {/* attachments */}
      {(image || link || voice || hearing) && (
        <View style={styles.attachments}>
          {image && <AttachedImage uri={'uri' in image ? image.uri : null} path={'path' in image ? image.path : null} onRemove={() => setImage(null)} />}
          <View style={{ gap: 8, flex: 1, minWidth: 0 }}>
            {voice && <AudioChip uri={voice.uri} path={voice.path} seconds={voice.seconds} onRemove={() => setVoice(null)} />}
            {hearing && (
              <View style={styles.hearing}>
                <ActivityIndicator size="small" color={Color.violet} />
                <Text style={styles.meta}>Writing down what you said…</Text>
              </View>
            )}
            {link && <LinkChip url={link} onRemove={() => setLink(null)} />}
          </View>
        </View>
      )}

      {recording && (
        <View style={{ marginTop: 12 }}>
          <RecordingBar seconds={recSecs} onStop={stopRecording} />
        </View>
      )}

      {imageMenu && (
        <View style={styles.menu}>
          <Chip icon="image" label="Photos" height={36} onPress={fromPhotos} />
          <Chip icon="doc" label="Files" height={36} onPress={fromFiles} />
        </View>
      )}

      {linkOpen && (
        <View style={[styles.linkRow, linkError && { borderColor: Color.white }]}>
          <Icon name="link" size={18} color={Color.text2} />
          <TextInput
            ref={linkInput}
            autoFocus
            value={linkText}
            onChangeText={(v) => {
              setLinkText(v);
              if (linkError) setLinkError(false);
            }}
            placeholder="Paste or type a link"
            placeholderTextColor={Color.meta}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={addLink}
            selectionColor={Color.violet}
            keyboardAppearance="dark"
            style={styles.linkInput}
          />
          <Pressable accessibilityRole="button" onPress={addLink} hitSlop={6} style={styles.linkAdd}>
            <Text style={[styles.menuText, { color: Color.violet }]}>Add</Text>
          </Pressable>
        </View>
      )}
      {linkOpen && linkError && <Text style={[styles.meta, { marginTop: 6, color: Color.white }]}>That doesn&apos;t look like a link. Try https://…</Text>}

      <View style={styles.tools}>
        {tools.map(([icon, label, onPress, on]) => (
          <Pressable key={icon} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.tool, on && styles.toolOn]}>
            <Icon name={icon} size={20} strokeWidth={1.6} color={on ? Color.violet : '#DDDDDD'} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tidy what I typed"
          onPress={() => text.trim() && setText((v) => v.trim().replace(/^./, (c) => c.toUpperCase()).replace(/[.!?]*$/, '.'))}
          style={styles.tool}>
          <Icon name="spark" size={20} color={Color.violet} />
        </Pressable>
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add note"
          accessibilityState={{ disabled: !canSave, busy: saving }}
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [styles.send, !canSave && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
          {saving ? <ActivityIndicator color={Color.black} /> : <Icon name="up" size={22} strokeWidth={2.4} color={Color.black} />}
        </Pressable>
      </View>
      <Text style={styles.hint}>The arrow button adds it to your notes. {ed} sees nothing until you press Send.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 12 },
  headText: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  att: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3A3A42' },
  attText: { fontFamily: Font.medium, fontSize: 14, lineHeight: 18, color: Color.text2 },
  row: { flexDirection: 'row', gap: 10 },
  thumb: { width: 46, height: 62, borderRadius: 4, overflow: 'hidden', backgroundColor: Color.control },
  drawthumb: { width: 68, aspectRatio: 9 / 16, borderRadius: 6, overflow: 'hidden', backgroundColor: Color.control },
  input: {
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
  attachments: { flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'flex-start' },
  hearing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  menu: { flexDirection: 'row', gap: 8, marginTop: 12 },
  menuText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.white },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 12, paddingLeft: 14, paddingRight: 6, borderRadius: 12, backgroundColor: Color.control, borderWidth: 1.5, borderColor: 'transparent' },
  linkInput: { flex: 1, minWidth: 0, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  linkAdd: { height: 36, paddingHorizontal: 12, justifyContent: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  tool: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolOn: { backgroundColor: Color.control },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.violet, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta, textAlign: 'center', marginTop: 10 },
});
