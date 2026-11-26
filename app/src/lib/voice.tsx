/**
 * Voice, the same way everywhere (voice notes on the video, the voice brief, Record in
 * Add note). Works in Expo Go with expo-audio:
 *  • asks for the mic first; if it's off, a sheet sends you to Settings
 *  • switches the audio session to "record" (video keeps playing), then back after
 *  • HIGH_QUALITY m4a, with a live timer and a real waveform from the recorder's metering
 * Speech → text happens on the server: the clip is uploaded to "project-files" and the
 * "transcribe" Edge Function (Groq Whisper) returns segments with start/end times.
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { Color, Font } from '@/constants/brand';
import { safeFileName, uploadWithProgress } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type Segment = { start: number; end: number; text: string };

const BARS = 32;

/** dB (-160…0) → 0…1 for the waveform. Quiet rooms sit around -50 dB. */
function level(db: number | undefined) {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 55) / 50));
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 80);
  const [recording, setRecording] = useState(false);
  const [denied, setDenied] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const lastMs = useRef(0);

  // One new bar per metering update while recording.
  useEffect(() => {
    if (!recording || !state.isRecording || state.durationMillis === lastMs.current) return;
    lastMs.current = state.durationMillis;
    setLevels((l) => [...l.slice(-(BARS - 1)), level(state.metering)]);
  }, [recording, state.isRecording, state.durationMillis, state.metering]);

  /** Starts recording. false when the mic is off (the Settings sheet opens) or it couldn't start. */
  async function start() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setDenied(true);
      return false;
    }
    try {
      // Recording and the video's sound at the same time, loud speaker, even on silent.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
      await recorder.prepareToRecordAsync();
      recorder.record();
      lastMs.current = 0;
      setLevels([]);
      setRecording(true);
      return true;
    } catch {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      return false;
    }
  }

  /** Stops and hands back the local file, or null if nothing was recorded. */
  async function stop() {
    const seconds = Math.max(1, Math.round(state.durationMillis / 1000));
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    // Back to normal playback so the video's sound plays normally again.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri ?? state.url ?? null;
    return uri ? { uri, seconds } : null;
  }

  const sheet = <MicOffSheet open={denied} onClose={() => setDenied(false)} />;

  return { start, stop, recording, seconds: Math.floor(state.durationMillis / 1000), levels, micSheet: sheet };
}

/** Upload a clip and turn it into text segments. null = it failed; [] = nothing heard. */
export async function transcribeClip(localUri: string, folder: string): Promise<{ path: string | null; segments: Segment[] | null }> {
  let path: string;
  try {
    path = `${folder}/${Date.now()}-${safeFileName('voice.m4a')}`;
    await uploadWithProgress({ path, uri: localUri, name: 'voice.m4a', mimeType: 'audio/mp4' }).done;
  } catch {
    return { path: null, segments: null };
  }
  try {
    const { data, error } = await supabase.functions.invoke<{ segments: Segment[] }>('transcribe', { body: { path } });
    if (error || !data) return { path, segments: null };
    return { path, segments: (data.segments ?? []).filter((s) => s.text?.trim()) };
  } catch {
    return { path, segments: null };
  }
}

/* ---------- live waveform from the mic ---------- */

export function LiveWave({ levels, bars = 16, height = 22, color = Color.white }: { levels: number[]; bars?: number; height?: number; color?: string }) {
  const shown = Array.from({ length: bars }, (_, i) => levels[levels.length - bars + i] ?? 0);
  return (
    <View style={[styles.wave, { height }]}>
      {shown.map((l, i) => (
        <View key={i} style={[styles.bar, { height: 3 + l * (height - 3), backgroundColor: color }]} />
      ))}
    </View>
  );
}

/* ---------- mic is off ---------- */

function MicOffSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(30, insets.bottom + 8) }]}>
        <View style={styles.grab} />
        <View style={styles.micIcon}>
          <Icon name="mic" size={24} />
        </View>
        <Text style={styles.t20}>Turn on the microphone in Settings</Text>
        <Text style={styles.t15}>Duoreels needs the mic to turn your voice into notes. Switch on Microphone, then come back.</Text>
        <BigButton
          label="Open Settings"
          onPress={() => {
            onClose();
            Linking.openSettings();
          }}
          style={{ marginTop: 18 }}
        />
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={[styles.t15, { color: Color.meta, marginTop: 0 }]}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 3, borderRadius: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: Color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#3A3A42', marginBottom: 16 },
  micIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Color.control, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white },
  t15: { fontFamily: Font.regular, fontSize: 15, lineHeight: 21, color: Color.text2, marginTop: 8 },
});
