/**
 * Final (prototype V.final): the approved video, quality toggle, Download, Post to social,
 * and what was paid to the editor.
 */
import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton, IconButton, Tag } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { DownloadOverlay } from '@/components/review/download-overlay';
import { Color, Font, Space } from '@/constants/brand';
import { editorName } from '@/lib/projects';
import { money, versionPicture, versionVideoUrl } from '@/lib/review';
import { currentVersion, loadReview, useReviewData } from '@/lib/review-store';
import { useOverlay } from '@/providers/overlay-provider';
import { useProject } from '@/providers/projects-provider';

function FinalVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls />;
}

export default function FinalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = useProject(id);
  const data = useReviewData(id);
  const { toast } = useOverlay();
  const cur = currentVersion(data);
  const [pic, setPic] = useState<ImageSource | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [quality, setQuality] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!data.versions.length) loadReview(id);
  }, [id, data.versions.length]);
  useEffect(() => {
    if (!cur) return;
    versionPicture(cur).then(setPic);
    versionVideoUrl(cur).then(setUrl);
  }, [cur]);

  if (!p) return null;
  const m = money(p);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title={p.name} sub={`v${p.current_version} approved`} right={<IconButton name="share" size={22} label="Share" onPress={() => {}} />} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.video}>
          {pic && <Image source={pic} style={StyleSheet.absoluteFill} contentFit="cover" />}
          {playing && url && <FinalVideo url={url} />}
          <Tag label="Approved · final" tone="violet" height={24} style={styles.tag} />
          {!playing && (
            <Pressable accessibilityRole="button" accessibilityLabel="Play" onPress={() => url && setPlaying(true)} style={styles.play}>
              <Icon name="play" size={28} />
            </Pressable>
          )}
        </View>

        <View style={styles.seg}>
          {['Original · 1080p', 'AI 4K'].map((label, i) => (
            <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: quality === i }} onPress={() => setQuality(i)} style={[styles.segBtn, quality === i && styles.segOn]}>
              {i === 1 && <Icon name="spark" size={12} color={quality === i ? Color.black : Color.text2} />}
              <Text style={[styles.segText, quality === i && { color: Color.black }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 12 }}>
          <BigButton label="Download" onPress={() => cur && setDownloading(true)} />
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push(`/project/${id}/post`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#26262A' }]}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Post to social</Text>
            <Text style={styles.meta}>Optional · cover, caption, apps</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {['T', 'R', 'S'].map((x) => (
              <View key={x} style={styles.app}>
                <Text style={styles.appText}>{x}</Text>
              </View>
            ))}
          </View>
          <Icon name="chev" size={18} />
        </Pressable>

        <View style={styles.card}>
          <Avatar k={p.editor_keys[0] ?? 'L'} size={34} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>
              ${m.onApproval} released to {editorName(p)}
            </Text>
            <Text style={styles.meta}>Paid when you approved · receipt in Me</Text>
          </View>
        </View>
      </ScrollView>
      {downloading && cur && <DownloadOverlay version={cur} projectName={p.name} onClose={() => setDownloading(false)} onError={(msg) => toast(msg)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  flex: { flex: 1, minWidth: 0 },
  video: { aspectRatio: 9 / 12, borderRadius: 10, overflow: 'hidden', backgroundColor: Color.surface },
  tag: { position: 'absolute', left: 10, top: 12 },
  play: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: { flexDirection: 'row', backgroundColor: '#141416', borderRadius: 8, padding: 3, gap: 3, marginTop: 14 },
  segBtn: { flex: 1, height: 30, borderRadius: 6, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: Color.white },
  segText: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 18, color: Color.text2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: Color.surface, marginTop: 12 },
  rowTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  app: { width: 22, height: 22, borderRadius: 6, backgroundColor: Color.control, alignItems: 'center', justifyContent: 'center' },
  appText: { fontFamily: Font.bold, fontSize: 14, lineHeight: 18, color: Color.white },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: Color.surface, marginTop: 12 },
});
