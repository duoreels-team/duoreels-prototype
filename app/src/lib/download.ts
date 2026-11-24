/**
 * Save a version to the phone's photo library (prototype act.download), with real progress.
 */
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

import type { Version } from '@/lib/review';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { signedUrl } from '@/lib/storage';

export type DownloadTask = { done: Promise<'saved' | 'cancelled'>; cancel: () => void };

export function fileName(projectName: string, v: number, ext = 'mp4') {
  return `${projectName.toLowerCase().replace(/[^a-z]+/g, '_')}_v${v}.${ext}`;
}

export function downloadVersion(version: Version, projectName: string, onProgress: (pct: number) => void): DownloadTask {
  let cancelled = false;
  let resumable: FileSystem.DownloadResumable | null = null;

  const done = (async () => {
    if (Platform.OS === 'web') throw new Error('Saving to Photos works on the phone');
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) throw new Error('permission');

    let local: string;
    if (version.video_path.startsWith('sample:')) {
      // Sample projects have a photo instead of a video.
      const asset = Asset.fromModule(SAMPLE_IMAGES[version.video_path.slice(7) as keyof typeof SAMPLE_IMAGES]);
      await asset.downloadAsync();
      local = asset.localUri!;
      for (let p = 0; p <= 100 && !cancelled; p += 20) {
        onProgress(p);
        await new Promise((r) => setTimeout(r, 90));
      }
    } else {
      const url = await signedUrl(version.video_path);
      if (!url) throw new Error('link');
      const ext = (version.video_path.split('.').pop() ?? 'mp4').toLowerCase();
      const target = `${FileSystem.cacheDirectory}${fileName(projectName, version.number, ext)}`;
      resumable = FileSystem.createDownloadResumable(url, target, {}, (p) => {
        if (p.totalBytesExpectedToWrite > 0) onProgress(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
      });
      const res = await resumable.downloadAsync();
      if (!res) return 'cancelled' as const;
      local = res.uri;
    }
    if (cancelled) return 'cancelled' as const;
    await MediaLibrary.saveToLibraryAsync(local);
    onProgress(100);
    return 'saved' as const;
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      resumable?.cancelAsync().catch(() => {});
    },
  };
}
