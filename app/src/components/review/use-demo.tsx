/**
 * The editor's side, played on your phone (prototype simUpload / simAsk + their banners).
 */
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/brand/bits';
import { AskSheet } from '@/components/review/project-sheets';
import { Color, Font } from '@/constants/brand';
import { simAsk, simUpload } from '@/lib/flow';
import { dotDate, editorName, useCover, type Project } from '@/lib/projects';
import { addDays } from '@/lib/review';
import { loadReview } from '@/lib/review-store';
import { useOverlay } from '@/providers/overlay-provider';
import { useProjects } from '@/providers/projects-provider';

function BannerThumb({ project }: { project: Project }) {
  const src = useCover(project);
  return <View style={styles.thumb}>{src && <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>;
}

export function useDemo() {
  const { refreshProject } = useProjects();
  const { banner, openSheet, toast } = useOverlay();
  const path = usePathname();

  const upload = useCallback(
    async (p: Project) => {
      const res = await simUpload(p);
      if (res.error || !res.v) {
        toast(res.error ?? "Couldn't load the new version");
        return;
      }
      await Promise.all([refreshProject(p.id), loadReview(p.id)]);
      const v = res.v;
      banner(
        <>
          <BannerThumb project={p} />
          <View style={styles.flex}>
            <Text style={styles.title}>
              {editorName(p)} uploaded v{v}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {p.name} · {v > 1 ? 'your notes fixed · ' : ''}tap to review
            </Text>
          </View>
        </>,
        () => {
          if (!path.startsWith(`/project/${p.id}`)) router.push(`/project/${p.id}`);
        },
      );
    },
    [banner, path, refreshProject, toast],
  );

  const ask = useCallback(
    async (p: Project) => {
      const res = await simAsk(p);
      if (res.error) {
        toast(res.error);
        return;
      }
      await refreshProject(p.id);
      const ed = p.editor_keys[0] ?? 'L';
      banner(
        <>
          <Avatar k={ed} size={36} />
          <View style={styles.flex}>
            <Text style={styles.title}>{editorName(p)} asks for 1 more day</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {p.name} · {dotDate(p.due_date)} → {dotDate(addDays(p.due_date, 1))}
            </Text>
          </View>
        </>,
        () => openSheet(<AskSheet projectId={p.id} />),
      );
    },
    [banner, openSheet, refreshProject, toast],
  );

  return { upload, ask };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  thumb: {
    width: 40,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Color.control,
  },
  title: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
  },
  meta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
  },
});
