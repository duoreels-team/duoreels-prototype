/**
 * The project screen = the review screen (prototype: V.project returns V.review).
 * Top bar, video, time row, strip, decision bar (#decide) and tool bar all follow
 * the project's state, exactly like the prototype's V.review + drawBottom().
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, IconButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { DButton, DecisionBar, DrawToolBar, ToolBar, VoiceBar, type ToolKey } from '@/components/review/bars';
import { DownloadOverlay } from '@/components/review/download-overlay';
import { DrawingOverlay, DrawLayer, strokesToSvg, type DrawTool, type Stroke } from '@/components/review/draw-layer';
import { NoteSheet, NotesSheet } from '@/components/review/note-sheets';
import { ApproveSheet, DetailsSheet, EditProjectSheet, useAskActions, VersionsSheet } from '@/components/review/project-sheets';
import { Stage, type Clock } from '@/components/review/stage';
import { Strip } from '@/components/review/strip';
import { useDemo } from '@/components/review/use-demo';
import { Color, Font } from '@/constants/brand';
import { approve as saveApprove } from '@/lib/flow';
import { dotDate, editorName, weekday } from '@/lib/projects';
import { addDays, canNote, fmt, fmtRange, money, reviewSubtitle, versionPicture, versionVideoUrl, whoKey, type Note, type Version } from '@/lib/review';
import { addNote, currentVersion, drafts as draftsOf, loadReview, pins as pinsOf, useReviewData } from '@/lib/review-store';
import { safeFileName, uploadWithProgress } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject, useProjects } from '@/providers/projects-provider';

type Mode = null | 'voice' | 'voiceWorking' | 'voiceDone' | 'voiceFail' | 'range' | 'draw';

type Segment = { start: number; end: number; text: string };

/** Video time at a moment of the recording, from the samples taken while you talked. */
function videoTimeAt(track: [number, number][], sec: number, fallback: number) {
  let best = track[0];
  for (const s of track) if (s[0] <= sec) best = s;
  return best ? best[1] + Math.max(0, sec - best[0]) : fallback;
}

function useVersionMedia(v: Version | null) {
  const [picture, setPicture] = useState<ImageSource | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!v) return;
    versionPicture(v).then((p) => live && setPicture(p));
    versionVideoUrl(v).then((u) => live && setVideoUrl(u));
    return () => {
      live = false;
    };
  }, [v]);
  return { picture: v ? picture : null, videoUrl: v ? videoUrl : null };
}

export default function ReviewScreen() {
  const { id, download } = useLocalSearchParams<{
    id: string;
    download?: string;
  }>();
  const insets = useSafeAreaInsets();
  const project = useProject(id);
  const data = useReviewData(id);
  const { refreshProject, setLocal } = useProjects();
  const { openSheet, closeSheet, toast } = useOverlay();
  const demo = useDemo();
  const { askYes, askNo } = useAskActions(id);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const cur = currentVersion(data);
  const prev = data.versions.length > 1 ? data.versions[data.versions.length - 2] : null;
  const { picture, videoUrl } = useVersionMedia(cur);
  const prevMedia = useVersionMedia(prev);

  const v = project?.current_version ?? 0;
  const dur = Math.max(1, Number(cur?.duration_seconds) || project?.duration_seconds || 30);
  const can = project ? canNote(project) : false;
  const draftList = draftsOf(data);
  const pinList = pinsOf(data);

  const [t, setT] = useState(() => (project && (project.new_version || !project.current_version) ? (project.current_version ? 2 : 0) : 12));
  const [clock, setClock] = useState<Clock>({
    playing: false,
    seekNonce: 0,
    seekTo: t,
  });
  const [mode, setMode] = useState<Mode>(null);
  const [range, setRange] = useState({ a: 12, b: 16 });
  const [tool, setTool] = useState<DrawTool>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawSize = useRef({ w: 1, h: 1 });
  const [cmp, setCmp] = useState(false);
  const [split, setSplit] = useState(50);
  const [full, setFull] = useState(false);
  const [hideBar, setHideBar] = useState(false);
  const [cd, setCd] = useState(10);
  const [voiceSecs, setVoiceSecs] = useState(0);
  const [voiceCount, setVoiceCount] = useState(0);
  // While you talk: [seconds into the recording, video time] every 250 ms.
  const voiceTrack = useRef<[number, number][]>([]);
  const voiceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [touchingStrip, setTouchingStrip] = useState(false);
  const navigation = useNavigation();
  const tNow = useRef(t);
  useEffect(() => {
    tNow.current = t;
  }, [t]);
  const [downloading, setDownloading] = useState(download === '1');
  const [cmpPics, setCmpPics] = useState<{
    a: ImageSource | null;
    b: ImageSource | null;
  }>({ a: null, b: null });

  useEffect(() => {
    loadReview(id);
  }, [id]);

  // No swipe-back while you drag on the strip, draw, set a range or talk.
  const holdStill = touchingStrip || mode === 'range' || mode === 'draw' || mode === 'voice' || mode === 'voiceWorking';
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !holdStill, fullScreenGestureEnabled: false });
  }, [navigation, holdStill]);

  /* ---------- clock ---------- */

  const seek = useCallback(
    (time: number) => {
      const tt = Math.max(0, Math.min(dur, time));
      setT(tt);
      setClock((c) => ({ ...c, seekTo: tt, seekNonce: c.seekNonce + 1 }));
    },
    [dur],
  );

  const playpause = useCallback(() => {
    setClock((c) => {
      const playing = !c.playing;
      if (playing && t >= dur - 0.2) return { playing, seekTo: 0, seekNonce: c.seekNonce + 1 };
      return { ...c, playing };
    });
  }, [t, dur]);

  const pause = useCallback(() => setClock((c) => (c.playing ? { ...c, playing: false } : c)), []);
  const onTime = useCallback((time: number) => setT(time), []);
  const onEnd = useCallback(() => setClock((c) => ({ ...c, playing: false })), []);

  /* ---------- the 10 s demo countdown while you wait (prototype RV.cd) ---------- */

  const waiting = !!project && !can && !project.asks_extra_day && project.status !== 'done';
  const waitKey = `${project?.current_version}-${project?.turn}-${project?.status}`;
  useEffect(() => {
    if (!waiting || !project) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the 10 s countdown when the state changes
    setCd(10);
    let n = 10;
    const timer = setInterval(() => {
      n -= 1;
      setCd(n);
      if (n <= 0) {
        clearInterval(timer);
        demo.upload(project);
      }
    }, 1000);
    return () => clearInterval(timer);
    // Restart only when the state changes, not on every project field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, waitKey]);

  useEffect(() => {
    // A new version arrives: close compare and the draw/range tools, show the bar again.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per version
    setCmp(false);
    setHideBar(false);
    setMode(null);
  }, [v]);

  /* ---------- notes ---------- */

  const openNote = (o: { t: number; b?: number | null; kind?: Note['kind']; drawingSvg?: string | null; edit?: Note }) => {
    pause();
    openSheet(<NoteSheet projectId={id} t={Math.round(o.t)} b={o.b} kind={o.kind} drawingSvg={o.drawingSvg} picture={picture} edit={o.edit} onSaved={(time) => seek(time)} />);
  };

  const openApprove = () => {
    if (!project) return;
    openSheet(
      <ApproveSheet
        projectId={id}
        onApprove={async () => {
          closeSheet();
          const res = await saveApprove(project);
          if (res.error) {
            toast(res.error);
            return;
          }
          setLocal(id, {
            status: 'done',
            done_kind: 'done',
            new_version: false,
            turn: 'them',
          });
          refreshProject(id);
          setTimeout(() => toast(`Approved · $${money(project).onApproval} sent to ${editorName(project)}`), 300);
        }}
      />,
    );
  };

  const openNotes = (tab: 'send' | 'all' = 'send') => {
    if (mode === 'voiceDone') setMode(null);
    const sheet = (initialTab: 'send' | 'all') => (
      <NotesSheet
        projectId={id}
        picture={picture}
        initialTab={initialTab}
        onEditDraft={(n) => {
          closeSheet();
          setTimeout(() => openNote({ t: n.time_seconds, edit: n }), 420);
        }}
        onApprove={() => {
          closeSheet();
          setTimeout(openApprove, 420);
        }}
        onSent={() => setHideBar(false)}
      />
    );
    openSheet(sheet(tab));
  };

  /* ---------- tools ---------- */

  async function startVoice() {
    if (!project || !cur) return;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      toast('Allow the microphone in Settings to talk to your editor', undefined, false);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setMode('voice');
    setVoiceSecs(0);
    setVoiceCount(0);
    if (!clock.playing) playpause();
    const started = Date.now();
    voiceTrack.current = [[0, tNow.current]];
    let ticks = 0;
    voiceTimer.current = setInterval(() => {
      voiceTrack.current.push([(Date.now() - started) / 1000, tNow.current]);
      ticks += 1;
      if (ticks % 4 === 0) setVoiceSecs(Math.round((Date.now() - started) / 1000));
    }, 250);
  }

  /** Done: upload the recording, transcribe it on the server, pin each part where you said it. */
  async function stopVoice() {
    if (voiceTimer.current) clearInterval(voiceTimer.current);
    pause();
    setMode('voiceWorking');
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri || !cur) {
      setMode('voiceFail');
      return;
    }
    let path: string;
    try {
      path = `${id}/voice/${Date.now()}-${safeFileName('voice.m4a')}`;
      await uploadWithProgress({ path, uri, name: 'voice.m4a', mimeType: 'audio/mp4' }).done;
    } catch {
      setMode('voiceFail');
      return;
    }
    // The recording stays in Storage even if nothing is heard.
    const { data, error } = await supabase.functions.invoke<{ segments: Segment[] }>('transcribe', { body: { path } });
    const segments = (data?.segments ?? []).filter((x) => x.text.trim());
    if (error || !segments.length) {
      setMode('voiceFail');
      return;
    }
    let made = 0;
    for (const seg of segments) {
      const at = Math.min(Math.max(0, dur - 0.5), Math.max(0, videoTimeAt(voiceTrack.current, seg.start, tNow.current)));
      const note = await addNote(id, { version_id: cur.id, time_seconds: Math.round(at * 10) / 10, body: seg.text.trim(), kind: 'voice', audio_path: path });
      if (note) made += 1;
    }
    setVoiceCount(made);
    setMode(made ? 'voiceDone' : 'voiceFail');
  }

  function onTool(k: ToolKey) {
    if (!project) return;
    if (k === 'cover') {
      router.push(`/project/${id}/cover`);
      return;
    }
    if (k === 'text') {
      openNote({ t });
      return;
    }
    if (k === 'voice') {
      if (mode === 'voice') stopVoice();
      else startVoice();
      return;
    }
    pause();
    if (k === 'range') {
      const a = Math.min(Math.round(t), Math.max(0, Math.floor(dur) - 5));
      setRange({ a, b: Math.min(Math.floor(dur), a + 4) });
      setMode('range');
      return;
    }
    if (k === 'draw') {
      setStrokes([]);
      setTool('pen');
      setMode('draw');
    }
  }

  /* ---------- compare ---------- */

  async function toggleCompare() {
    if (cmp) {
      setCmp(false);
      return;
    }
    pause();
    const shot = async (url: string | null, still: ImageSource | null) => {
      if (!url) return still;
      try {
        return {
          uri: (
            await VideoThumbnails.getThumbnailAsync(url, {
              time: Math.round(t * 1000),
              quality: 0.7,
            })
          ).uri,
        };
      } catch {
        return still;
      }
    };
    const [a, b] = await Promise.all([shot(prevMedia.videoUrl, prevMedia.picture), shot(videoUrl, picture)]);
    setCmpPics({ a, b });
    setSplit(50);
    setCmp(true);
    toast(`Comparing v${v - 1} | v${v} · drag the line`, undefined, false);
  }

  const [stageW, setStageW] = useState(1);
  const stageWRef = useRef(1);
  useEffect(() => {
    stageWRef.current = stageW;
  }, [stageW]);
  function setSplitFromX(x: number) {
    setSplit(Math.min(95, Math.max(5, (x / stageWRef.current) * 100)));
  }
  // eslint-disable-next-line react-hooks/refs -- the handlers read refs only while a finger moves, never during render
  const cmpPan = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setSplitFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setSplitFromX(e.nativeEvent.locationX),
    }),
  )[0];

  /* ---------- what's on screen ---------- */

  const nearPin = useMemo(() => pinList.find((p) => Math.abs(p.t - t) < 1.2), [pinList, t]);
  const nearNote = useMemo(() => {
    if (!nearPin || !cur) return null;
    return data.notes.find((n) => n.version_id === cur.id && Math.abs(n.time_seconds - nearPin.t) < 0.01 && n.by_key === nearPin.by) ?? null;
  }, [nearPin, data.notes, cur]);
  const drawingHere = useMemo(() => {
    if (mode === 'draw' || !cur) return null;
    return data.notes.find((n) => n.version_id === cur.id && n.drawing_svg && Math.abs(n.time_seconds - t) < 2)?.drawing_svg ?? null;
  }, [mode, cur, data.notes, t]);
  const rangeBars = draftList.filter((d) => d.end_seconds).map((d) => ({ t: d.time_seconds, b: d.end_seconds! }));

  if (!project) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <Text style={styles.meta}>This project isn&apos;t here anymore.</Text>
        <BigButton label="Back to projects" tone="control" onPress={() => router.back()} style={{ marginTop: 16, alignSelf: 'stretch', marginHorizontal: 16 }} />
      </View>
    );
  }

  const ed = editorName(project);
  const edKey = project.editor_keys[0] ?? 'L';
  const n = draftList.length;
  const m = money(project);

  /* ---------- decision bar (drawBottom) ---------- */

  let decide: React.ReactNode = null;
  if (mode === 'voice') decide = <VoiceBar editorName={ed} seconds={voiceSecs} onDone={stopVoice} />;
  else if (mode === 'voiceWorking')
    decide = (
      <DecisionBar icon="mic" title="Listening back…" sub={`Turning ${fmt(voiceSecs)} of talk into notes`}>
        <ActivityIndicator color={Color.violet} />
      </DecisionBar>
    );
  else if (mode === 'voiceFail')
    decide = (
      <DecisionBar icon="mic" title="Couldn't hear anything" sub="Your recording is kept" onHide={() => setMode(null)}>
        <DButton label="Try again" onPress={startVoice} />
      </DecisionBar>
    );
  else if (mode === 'voiceDone')
    decide = (
      <DecisionBar icon="spark" title={`${voiceCount} note${voiceCount === 1 ? '' : 's'} from your voice`} sub="Pinned on the timeline · check them" onHide={() => setMode(null)}>
        <DButton label="Check" onPress={() => openNotes('send')} />
      </DecisionBar>
    );
  else if (mode === 'range')
    decide = (
      <DecisionBar icon="range" title={`${fmt(range.a)} – ${fmt(range.b)} · ${range.b - range.a} s`} sub="Drag the edges to set the part">
        <DButton label="Cancel" tone="control" onPress={() => setMode(null)} />
        <DButton
          label="Add"
          onPress={() => {
            setMode(null);
            openNote({ t: range.a, b: range.b, kind: 'range' });
          }}
        />
      </DecisionBar>
    );
  else if (mode === 'draw')
    decide = (
      <DecisionBar icon="pen" title={`Draw on ${fmt(t)}`} sub="Circle it, point at it, scribble">
        <DButton label="Cancel" tone="control" onPress={() => setMode(null)} />
        <DButton
          label="Next"
          onPress={() => {
            const svg = strokes.length ? strokesToSvg(strokes, drawSize.current.w, drawSize.current.h) : null;
            setMode(null);
            openNote({ t, kind: 'draw', drawingSvg: svg });
          }}
        />
      </DecisionBar>
    );
  else if (project.asks_extra_day)
    decide = (
      <DecisionBar who={edKey} title="1 more day?" sub={`${dotDate(project.due_date)} → ${dotDate(addDays(project.due_date, 1))}`}>
        <DButton label="Decline" tone="control" onPress={askNo} />
        <DButton label="Accept" onPress={askYes} />
      </DecisionBar>
    );
  else if (project.status === 'done')
    decide = (
      <DecisionBar who="M" title={`v${v} is final`} sub={`$${m.onApproval} sent to ${ed}`}>
        <DButton label="Save" tone="control" icon="dl" onPress={() => setDownloading(true)} />
        <DButton label="Post" onPress={() => router.push(`/project/${id}/post`)} />
      </DecisionBar>
    );
  else if (!can)
    decide = (
      <DecisionBar who={edKey} title={`Waiting on ${ed} · v${v + 1}`} sub={`Due ${weekday(project.due_date)} · demo: ${Math.max(0, cd)} s`}>
        <DButton label="Upload now" tone="control" icon="bolt" onPress={() => demo.upload(project)} />
      </DecisionBar>
    );
  else if (hideBar) decide = null;
  else if (n)
    decide = (
      <DecisionBar who="M" title={`Send your ${n} note${n > 1 ? 's' : ''} to ${ed}`} sub={`He starts v${v + 1} after you send`} onHide={() => setHideBar(true)}>
        <DButton label="Send" onPress={() => openNotes('send')} />
      </DecisionBar>
    );
  else
    decide = (
      <DecisionBar
        who="M"
        title={v >= project.rounds ? `Last round · v${v}` : 'No new notes'}
        sub={v >= project.rounds ? 'Approve it, or send notes for one more round' : `Happy with v${v}?`}
        onHide={() => setHideBar(true)}
      >
        <DButton label="Approve" onPress={openApprove} />
      </DecisionBar>
    );

  const stageKind = !v ? 'empty' : cur?.media_kind === 'video' && videoUrl ? 'video' : 'image';

  return (
    <View style={[styles.screen, { paddingTop: full ? 0 : insets.top }]}>
      <StatusBar style="light" />

      {!full && (
        <View style={styles.topbar}>
          <IconButton name="back" label="Back" onPress={() => router.back()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Edit project" onPress={() => openSheet(<EditProjectSheet projectId={id} />)} style={styles.tt}>
            <Text style={styles.ttTitle} numberOfLines={1}>
              {project.name}
            </Text>
            <View style={styles.ttSub}>
              <View style={styles.tinyAv}>
                <Avatar k={whoKey(project)} size={14} />
              </View>
              <Text style={styles.ttSubText} numberOfLines={1}>
                {reviewSubtitle(project)}
              </Text>
            </View>
          </Pressable>
          <IconButton name="dl" size={22} label={`Download v${v}`} onPress={() => v && setDownloading(true)} style={!v && { opacity: 0.3 }} />
          <IconButton
            name="more"
            label="Project details"
            onPress={() =>
              openSheet(
                <DetailsSheet
                  projectId={id}
                  onVersions={() =>
                    openSheet(
                      <VersionsSheet
                        projectId={id}
                        onCompare={() => {
                          closeSheet();
                          setTimeout(toggleCompare, 450);
                        }}
                      />,
                    )
                  }
                  demo={{
                    upload: () => demo.upload(project),
                    ask: () => demo.ask(project),
                  }}
                />,
              )
            }
          />
        </View>
      )}

      {/* video */}
      <View style={styles.player}>
        <View
          style={styles.stageWrap}
          onLayout={(e) => {
            setStageW(Math.min(e.nativeEvent.layout.width, (e.nativeEvent.layout.height * 9) / 16) || 1);
          }}
        >
          <Stage kind={stageKind} videoUrl={videoUrl} picture={picture} duration={dur} clock={clock} onTime={onTime} onEnd={onEnd} editorName={ed}>
            {drawingHere && <DrawingOverlay svg={drawingHere} />}
            {/* Tap the video: pin a note at this moment (your turn), or play/pause. */}
            {v > 0 && mode !== 'draw' && !cmp && (
              <Pressable accessibilityLabel={can ? 'Add a note here' : 'Play or pause'} style={StyleSheet.absoluteFill} onPress={() => (can ? openNote({ t }) : playpause())} />
            )}
            {nearPin && !clock.playing && mode !== 'draw' && !cmp && (
              <Animated.View entering={ZoomIn.duration(400)} style={styles.pinb} pointerEvents="none">
                <Avatar k={nearPin.by} size={22} />
                <Text style={styles.pinbTime}>{nearNote ? fmtRange(nearNote) : fmt(nearPin.t)}</Text>
                <Text style={styles.pinbText} numberOfLines={1}>
                  {nearNote?.body ?? ''}
                </Text>
              </Animated.View>
            )}
            {v > 0 && !clock.playing && mode !== 'draw' && !cmp && (
              <Pressable accessibilityRole="button" accessibilityLabel="Play" onPress={playpause} style={styles.pbtn}>
                <Icon name="play" size={30} />
              </Pressable>
            )}
            {mode === 'draw' && <DrawLayer tool={tool} strokes={strokes} onStrokes={setStrokes} onSize={(w, h) => (drawSize.current = { w, h })} />}
            {cmp && (
              <View style={StyleSheet.absoluteFill} {...cmpPan.panHandlers}>
                {cmpPics.b && <Image source={cmpPics.b} style={StyleSheet.absoluteFill} contentFit="cover" />}
                <View style={[StyleSheet.absoluteFill, { width: `${split}%`, overflow: 'hidden' }]}>
                  {cmpPics.a && (
                    <Image
                      source={cmpPics.a}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: stageW,
                      }}
                      contentFit="cover"
                    />
                  )}
                </View>
                <View style={[styles.cmpDiv, { left: `${split}%` }]}>
                  <View style={styles.cmpKnob}>
                    <Text style={styles.cmpKnobText}>‹ ›</Text>
                  </View>
                </View>
                <Text style={[styles.vlabel, { left: 10 }]}>v{v - 1}</Text>
                <Text style={[styles.vlabel, { right: 10 }]}>v{v}</Text>
              </View>
            )}
          </Stage>
        </View>
      </View>

      {/* time row */}
      <View style={styles.timerow}>
        <Text style={styles.time}>
          {fmt(t)} / {fmt(dur)}
        </Text>
        <View style={styles.flex} />
        <IconButton name={clock.playing ? 'pause' : 'play'} label="Play" onPress={() => v && playpause()} style={!v && { opacity: 0.3 }} />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            v &&
            openSheet(
              <VersionsSheet
                projectId={id}
                onCompare={() => {
                  closeSheet();
                  setTimeout(toggleCompare, 450);
                }}
              />,
            )
          }
          style={styles.vchip}
        >
          <Text style={styles.vchipText}>{v ? `v${v}` : 'No video yet'}</Text>
          {v > 0 && <Icon name="down" size={14} />}
        </Pressable>
        {v > 1 && <IconButton name="compare" size={20} label="Compare" onPress={toggleCompare} />}
        {v > 0 && <IconButton name="full" size={20} label="Full screen" onPress={() => setFull((f) => !f)} />}
      </View>

      {!full && (
        <Strip
          style={styles.strip}
          duration={dur}
          t={t}
          frames={v ? { picture, videoUrl } : 'empty'}
          pins={pinList}
          ranges={rangeBars}
          range={mode === 'range' ? range : null}
          onSeek={(time) => {
            pause();
            seek(time);
          }}
          onRange={(a, b) => setRange({ a, b })}
          onTouch={setTouchingStrip}
        />
      )}

      {data.status === 'loading' && !data.versions.length && v > 0 ? (
        <View style={styles.loadingBar}>
          <ActivityIndicator color={Color.violet} />
        </View>
      ) : (
        decide
      )}

      {!full && (
        <View style={{ paddingBottom: Math.max(28, insets.bottom) }}>
          {mode === 'draw' ? (
            <DrawToolBar tool={tool} onTool={setTool} onUndo={() => setStrokes((s) => s.slice(0, -1))} />
          ) : (
            <ToolBar enabled={(k) => v > 0 && (can || k === 'cover') && mode !== 'voiceWorking'} voiceOn={mode === 'voice'} notes={n} onTool={onTool} onNotes={() => openNotes('send')} />
          )}
        </View>
      )}

      {downloading && cur && <DownloadOverlay version={cur} projectName={project.name} onClose={() => setDownloading(false)} onError={(msg) => toast(msg)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Color.black,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
  topbar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
  },
  tt: {
    flex: 1,
    minWidth: 0,
  },
  ttTitle: {
    fontFamily: Font.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: Color.white,
  },
  ttSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  tinyAv: {
    width: 14,
    height: 14,
    overflow: 'hidden',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttSubText: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 18,
    color: Color.meta,
  },
  player: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.black,
  },
  stageWrap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  pbtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinb: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pinbTime: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Color.text2,
  },
  pinbText: {
    flex: 1,
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  cmpDiv: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: Color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cmpKnob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cmpKnobText: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.black,
  },
  vlabel: {
    position: 'absolute',
    top: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  timerow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    paddingLeft: 16,
    paddingRight: 12,
  },
  time: {
    width: 96,
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Color.white,
  },
  vchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Color.control,
  },
  vchipText: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: Color.white,
  },
  strip: {
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  loadingBar: {
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
