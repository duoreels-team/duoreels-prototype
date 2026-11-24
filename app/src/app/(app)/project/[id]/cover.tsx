/**
 * Cover (prototype V.coverpick): vertical / horizontal, drag the 3:4 box,
 * edit the title, drag along the strip to pick the frame, Save.
 */
import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageTop } from '@/components/brand/top-bar';
import { Color, Font } from '@/constants/brand';
import { fmt, versionPicture, versionVideoUrl } from '@/lib/review';
import { currentVersion, loadReview, useReviewData } from '@/lib/review-store';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { uploadWithProgress } from '@/lib/storage';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

export default function CoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const data = useReviewData(id);
  const { update } = useProjects();
  const { toast } = useOverlay();
  const cur = currentVersion(data);
  const dur = Math.max(1, Number(cur?.duration_seconds) || p?.duration_seconds || 30);

  const [pic, setPic] = useState<ImageSource | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [orient, setOrient] = useState<'v' | 'h'>('v');
  const [x, setX] = useState(p?.cover_seconds != null ? p.cover_seconds / dur : 0.46);
  const [frame, setFrame] = useState<string | null>(null);
  const [title, setTitle] = useState(p?.cover_title ?? 'My 5 am routine');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [stripW, setStripW] = useState(1);
  const stripWRef = useRef(1);
  useEffect(() => {
    stripWRef.current = stripW;
  }, [stripW]);

  useEffect(() => {
    if (!data.versions.length) loadReview(id);
  }, [id, data.versions.length]);
  useEffect(() => {
    if (!cur) return;
    versionPicture(cur).then(setPic);
    versionVideoUrl(cur).then(setUrl);
  }, [cur]);

  // A real frame for videos.
  useEffect(() => {
    if (!url) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const r = await VideoThumbnails.getThumbnailAsync(url, { time: Math.round(x * dur * 1000), quality: 0.8 });
        if (live) setFrame(r.uri);
      } catch {
        // keep the last frame
      }
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [url, x, dur]);

  // eslint-disable-next-line react-hooks/refs -- the handlers read refs only while a finger moves, never during render
  const stripPan = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setX(Math.min(1, Math.max(0, e.nativeEvent.locationX / stripWRef.current))),
      onPanResponderMove: (e) => setX(Math.min(1, Math.max(0, e.nativeEvent.locationX / stripWRef.current))),
    }),
  )[0];

  // The 3:4 box: in vertical it slides up/down, in horizontal left/right.
  const sq = orient === 'v' ? { w: box.w, h: Math.min(box.h, (box.w * 4) / 3) } : { w: (box.h * 3) / 4, h: box.h };
  const room = orient === 'v' ? box.h - sq.h : box.w - sq.w;
  const pos = offset ?? room / 2;
  const start = useRef(0);
  const posRef = useRef(pos);
  const roomRef = useRef(room);
  const orientRef = useRef(orient);
  useEffect(() => {
    posRef.current = pos;
    roomRef.current = room;
    orientRef.current = orient;
  }, [pos, room, orient]);
  // eslint-disable-next-line react-hooks/refs -- the handlers read refs only while a finger moves, never during render
  const boxPan = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = posRef.current;
      },
      onPanResponderMove: (_, g) => {
        const d = orientRef.current === 'v' ? g.dy : g.dx;
        setOffset(Math.min(roomRef.current, Math.max(0, start.current + d)));
      },
    }),
  )[0];

  if (!p) return null;
  const shown: ImageSource | null = orient === 'h' ? SAMPLE_IMAGES.mk2 : frame ? { uri: frame } : pic;

  async function save() {
    if (!p) return;
    setSaving(true);
    const fields: Record<string, unknown> = { cover_seconds: Math.round(x * dur * 10) / 10, cover_title: title.trim() || null };
    if (frame) {
      try {
        const path = `${id}/cover-${Date.now()}.jpg`;
        await uploadWithProgress({ path, uri: frame, name: 'cover.jpg', mimeType: 'image/jpeg' }).done;
        fields.cover_image = path;
      } catch {
        // keep the old cover picture, still save the time + title
      }
    }
    const err = await update(id, fields);
    setSaving(false);
    if (err) {
      toast(err);
      return;
    }
    router.back();
    toast('Cover saved');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <PageTop
        title="Cover"
        sub="3:4 · used on Home, All projects and Done"
        right={
          <Pressable accessibilityRole="button" onPress={save} disabled={saving} style={({ pressed }) => [styles.card, pressed && { backgroundColor: Color.white }]}>
            {({ pressed }) => <Text style={[styles.cardText, pressed && { color: Color.black }]}>{saving ? 'SAVING' : 'SAVE'}</Text>}
          </Pressable>
        }
      />
      <View style={[styles.seg, { marginHorizontal: 16, marginTop: 4 }]}>
        {(
          [
            ['v', 'Vertical 9:16'],
            ['h', 'Horizontal 16:9'],
          ] as const
        ).map(([k, l]) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: orient === k }}
            onPress={() => {
              setOrient(k);
              setOffset(null);
            }}
            style={[styles.segBtn, orient === k && styles.segOn]}>
            <Text style={[styles.segText, orient === k && { color: Color.black }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stage}>
        <View
          style={[styles.cov, orient === 'v' ? { height: '100%', aspectRatio: 9 / 16 } : { width: '100%', aspectRatio: 16 / 9 }]}
          onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {shown && (
            <Image
              source={shown}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition={frame && orient === 'v' ? 'center' : { left: `${x * 100}%`, top: `${30 + x * 40}%` }}
            />
          )}
          {box.w > 0 && (
            <>
              {/* dim outside the 3:4 box */}
              {orient === 'v' ? (
                <>
                  <View style={[styles.dim, { left: 0, right: 0, top: 0, height: pos }]} />
                  <View style={[styles.dim, { left: 0, right: 0, top: pos + sq.h, bottom: 0 }]} />
                </>
              ) : (
                <>
                  <View style={[styles.dim, { top: 0, bottom: 0, left: 0, width: pos }]} />
                  <View style={[styles.dim, { top: 0, bottom: 0, left: pos + sq.w, right: 0 }]} />
                </>
              )}
              <View {...boxPan.panHandlers} style={[styles.sq, orient === 'v' ? { left: 0, top: pos, width: sq.w, height: sq.h } : { top: 0, left: pos, width: sq.w, height: sq.h }]}>
                <TextInput value={title} onChangeText={setTitle} style={styles.ctitle} selectionColor={Color.violet} keyboardAppearance="dark" accessibilityLabel="Cover title" />
              </View>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.meta, { textAlign: 'center', marginHorizontal: 20 }]}>Auto = centre of the middle frame. Drag the 3:4 box, or pick another frame below.</Text>
      <View style={styles.timeRow}>
        <Text style={styles.mono}>
          {fmt(x * dur)} / {fmt(dur)}
        </Text>
        <Text style={styles.meta}>Drag to pick the frame</Text>
      </View>
      <View style={styles.cstrip} onLayout={(e) => setStripW(e.nativeEvent.layout.width || 1)} {...stripPan.panHandlers}>
        <View style={styles.frames} pointerEvents="none">
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={styles.frame}>
              {pic && <Image source={pic} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: `${i * 12}%`, top: `${30 + i * 5}%` }} />}
            </View>
          ))}
        </View>
        <View pointerEvents="none" style={[styles.win, { left: Math.min(stripW - 40, Math.max(0, x * stripW - 20)) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  card: { height: 32, paddingHorizontal: 14, marginRight: 6, borderRadius: 12, borderWidth: 1.5, borderColor: Color.white, justifyContent: 'center' },
  cardText: { fontFamily: Font.display, fontSize: 16, lineHeight: 20, paddingTop: 2, letterSpacing: 0.5, color: Color.white },
  seg: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  cov: { maxWidth: '100%', borderRadius: 6, overflow: 'hidden', backgroundColor: Color.surface },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)' },
  sq: { position: 'absolute', borderWidth: 2.5, borderColor: Color.white, borderRadius: 6, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '12%' },
  ctitle: {
    backgroundColor: Color.black,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    fontFamily: Font.bold,
    fontSize: 15,
    color: Color.white,
    textAlign: 'center',
  },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  mono: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18, color: Color.meta },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 16 },
  cstrip: { height: 56, marginTop: 10, marginHorizontal: 16, marginBottom: 30 },
  frames: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 2, borderRadius: 6, overflow: 'hidden' },
  frame: { flex: 1, overflow: 'hidden', opacity: 0.85, backgroundColor: Color.surface },
  win: { position: 'absolute', top: -4, bottom: -4, width: 40, borderWidth: 2.5, borderColor: Color.white, borderRadius: 6 },
});
