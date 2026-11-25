/**
 * Cover (prototype V.coverpick): vertical / horizontal, drag the 3:4 box,
 * edit the title, drag along the strip to pick the frame, Save.
 *
 * Smooth picking: the strip's thumbnails are made once (about one per second of
 * video) and cached. The drag runs on the UI thread; while you drag, the time label
 * and the preview (nearest cached thumbnail) update; the exact frame is made on release.
 */
import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { PageTop } from '@/components/brand/top-bar';
import { Color, Font } from '@/constants/brand';
import { fmt, versionPicture, versionVideoUrl } from '@/lib/review';
import { currentVersion, loadReview, useReviewData } from '@/lib/review-store';
import { uploadWithProgress } from '@/lib/storage';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

/** Thumbnails per video, made once per app session (one per second, at most 90). */
const thumbCache = new Map<string, (string | null)[]>();

function useStripThumbs(url: string | null, dur: number) {
  const count = Math.max(1, Math.min(90, Math.round(dur)));
  const [thumbs, setThumbs] = useState<(string | null)[]>(() => (url && thumbCache.get(url)) || []);
  useEffect(() => {
    if (!url) return;
    const cached = thumbCache.get(url);
    if (cached && cached.length >= count) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show what's already cached for this video
      setThumbs(cached);
      return;
    }
    let live = true;
    (async () => {
      const out: (string | null)[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const r = await VideoThumbnails.getThumbnailAsync(url, { time: Math.round(((i + 0.5) / count) * dur * 1000), quality: 0.3 });
          out.push(r.uri);
        } catch {
          out.push(null);
        }
        // Keep going even if you leave, so coming back is instant.
        thumbCache.set(url, [...out]);
        if (live && (i % 4 === 3 || i === count - 1)) setThumbs([...out]);
      }
    })();
    return () => {
      live = false;
    };
  }, [url, dur, count]);
  /** The cached thumbnail closest to 0–1 along the video. */
  const nearest = (x: number) => {
    if (!thumbs.length) return null;
    const i = Math.min(count - 1, Math.max(0, Math.round(x * count - 0.5)));
    for (let d = 0; d < count; d++) {
      const a = thumbs[i - d];
      if (a) return a;
      const b = thumbs[i + d];
      if (b) return b;
    }
    return null;
  };
  return { thumbs, nearest };
}

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
  const [title, setTitle] = useState(p?.cover_title ?? '');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [stripW, setStripW] = useState(1);
  /** While dragging: where the finger is (0–1), for the label and the preview. */
  const [dragX, setDragX] = useState<number | null>(null);

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

  const { thumbs, nearest } = useStripThumbs(url, dur);

  /* the frame strip: the white window follows your finger on the UI thread */
  const sx = useSharedValue(x);
  const sw = useSharedValue(1);
  const step = useSharedValue(-1);
  const dragging = useSharedValue(0);
  useEffect(() => {
    if (!dragging.get()) sx.set(x);
  }, [x, sx, dragging]);
  const durS = useSharedValue(dur);
  useEffect(() => {
    durS.set(dur);
  }, [dur, durS]);
  const liveJS = (v: number) => setDragX(v);
  const doneJS = (v: number) => {
    setDragX(null);
    setX(v);
  };
  const stripPan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      dragging.set(1);
      const v = Math.min(1, Math.max(0, e.x / (sw.get() || 1)));
      sx.set(v);
      step.set(Math.floor(v * durS.get()));
      scheduleOnRN(liveJS, v);
    },
    onUpdate: (e) => {
      'worklet';
      const v = Math.min(1, Math.max(0, e.x / (sw.get() || 1)));
      sx.set(v);
      // Tell JS only when the second changes: the label reads m:ss, the preview is per second.
      const st = Math.floor(v * durS.get());
      if (st !== step.get()) {
        step.set(st);
        scheduleOnRN(liveJS, v);
      }
    },
    onFinalize: () => {
      'worklet';
      dragging.set(0);
      scheduleOnRN(doneJS, sx.get());
    },
  });
  const winStyle = useAnimatedStyle(() => ({ left: Math.min(sw.get() - 40, Math.max(0, sx.get() * sw.get() - 20)) }));

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
  const preview = dragX !== null ? nearest(dragX) : null;
  const shown: ImageSource | null = preview ? { uri: preview } : frame ? { uri: frame } : pic;
  const tShown = (dragX ?? x) * dur;

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
              contentPosition={preview || frame ? 'center' : { left: `${x * 100}%`, top: `${30 + x * 40}%` }}
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
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Add a title"
                  placeholderTextColor={Color.meta}
                  style={styles.ctitle}
                  selectionColor={Color.violet}
                  keyboardAppearance="dark"
                  accessibilityLabel="Cover title"
                />
              </View>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.meta, { textAlign: 'center', marginHorizontal: 20 }]}>Auto = centre of the middle frame. Drag the 3:4 box, or pick another frame below.</Text>
      <View style={styles.timeRow}>
        <Text style={styles.mono}>
          {fmt(tShown)} / {fmt(dur)}
        </Text>
        <Text style={styles.meta}>Drag to pick the frame</Text>
      </View>
      <GestureDetector gesture={stripPan}>
        <Animated.View
          style={styles.cstrip}
          onLayout={(e) => {
            setStripW(e.nativeEvent.layout.width || 1);
            sw.set(e.nativeEvent.layout.width || 1);
          }}>
          <View style={styles.frames} pointerEvents="none">
            {Array.from({ length: 9 }, (_, i) => {
              const th = thumbs.length ? nearest((i + 0.5) / 9) : null;
              return (
                <View key={i} style={styles.frame}>
                  {th ? (
                    <Image source={{ uri: th }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    pic && <Image source={pic} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: `${i * 12}%`, top: `${30 + i * 5}%` }} />
                  )}
                </View>
              );
            })}
          </View>
          {stripW > 1 && <Animated.View pointerEvents="none" style={[styles.win, winStyle]} />}
        </Animated.View>
      </GestureDetector>
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
