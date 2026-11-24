/**
 * A project's files (footage clips and brief references), shared by every screen
 * that shows them: project details, the editor's Footage / Brief, the join page and
 * the Brief page. One small store per project so they all stay in sync, including
 * uploads that are still going (shown with the striped bar).
 */
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useSyncExternalStore } from 'react';

import { logActivity } from '@/lib/flow';
import { removeFiles, safeFileName, uploadWithProgress, UploadError, type UploadTask } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type FileKind = 'clip' | 'reference';

export type FileRow = {
  id: string;
  kind: FileKind;
  title: string | null;
  file_path: string | null;
  link_url: string | null;
  thumb_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  added_by: string | null;
  created_at: string;
};

/** A file on its way up. */
export type Upload = { key: string; kind: FileKind; name: string; thumb: string | null; percent: number; state: 'up' | 'error'; meta: string; task?: UploadTask };

type Files = { status: 'loading' | 'ready' | 'error'; rows: FileRow[]; ups: Upload[] };

const EMPTY: Files = { status: 'loading', rows: [], ups: [] };
const store = new Map<string, Files>();
const listeners = new Set<() => void>();

function get(pid: string) {
  return store.get(pid) ?? EMPTY;
}
function set(pid: string, next: Partial<Files>) {
  store.set(pid, { ...get(pid), ...next });
  listeners.forEach((l) => l());
}
function patchUp(pid: string, key: string, fields: Partial<Upload>) {
  set(pid, { ups: get(pid).ups.map((u) => (u.key === key ? { ...u, ...fields } : u)) });
}

const COLS = 'id, kind, title, file_path, link_url, thumb_path, duration_seconds, size_bytes, mime_type, added_by, created_at';

export async function loadFiles(pid: string) {
  const { data, error } = await supabase.from('footage').select(COLS).eq('project_id', pid).order('created_at');
  if (error) {
    set(pid, { status: get(pid).rows.length ? 'ready' : 'error' });
    return;
  }
  set(pid, { status: 'ready', rows: (data as FileRow[]) ?? [] });
}

export function useProjectFiles(pid: string) {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => get(pid),
  );
  useEffect(() => {
    loadFiles(pid);
  }, [pid]);
  return snap;
}

/* ---------- labels ---------- */

export function sizeLabel(bytes: number | null | undefined) {
  if (!bytes) return null;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function linkSource(url: string) {
  if (/drive\.google|docs\.google/i.test(url)) return 'Google Drive';
  if (/dropbox/i.test(url)) return 'Dropbox';
  if (/icloud/i.test(url)) return 'iCloud';
  if (/wetransfer|we\.tl/i.test(url)) return 'WeTransfer';
  if (/instagram/i.test(url)) return 'Instagram';
  if (/tiktok/i.test(url)) return 'TikTok';
  if (/youtu/i.test(url)) return 'YouTube';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

export function isVideoRow(r: Pick<FileRow, 'mime_type' | 'duration_seconds'>) {
  return (r.mime_type ?? '').startsWith('video/') || (!r.mime_type && !!r.duration_seconds);
}

/* ---------- add ---------- */

let seq = 0;
const newKey = () => `up${Date.now()}${seq++}`;

/** "+ Add footage" / "+ Add reference" → Photos (several at once). Returns how many were picked. */
export async function addFromLibrary(pid: string, kind: FileKind, me: { id?: string; name: string }) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'], allowsMultipleSelection: true, quality: 1 });
  if (result.canceled) return 0;
  const jobs = result.assets.map((asset) => {
    const key = newKey();
    const isVideo = asset.type === 'video';
    const name = asset.fileName ?? `${isVideo ? 'VIDEO' : 'IMG'}_${key.slice(-6)}.${isVideo ? 'MOV' : 'JPG'}`;
    const meta = [sizeLabel(asset.fileSize), 'from phone'].filter(Boolean).join(' · ');
    set(pid, { ups: [...get(pid).ups, { key, kind, name, thumb: isVideo ? null : asset.uri, percent: 0, state: 'up', meta }] });
    return uploadOne(pid, kind, key, asset, name, isVideo, me.id);
  });
  // Uploads keep going in the background; Activity gets one line when they're up.
  Promise.all(jobs).then((ok) => {
    const done = ok.filter(Boolean).length;
    if (done && kind === 'clip') logActivity({ project_id: pid, by_key: 'M', title: `New footage from ${me.name}`, body: `${done} clip${done === 1 ? '' : 's'} added`, unread: false });
  });
  return result.assets.length;
}

async function uploadOne(pid: string, kind: FileKind, key: string, asset: ImagePicker.ImagePickerAsset, name: string, isVideo: boolean, uid?: string) {
  const mimeType = asset.mimeType ?? (isVideo ? 'video/quicktime' : 'image/jpeg');
  let thumbUri: string | null = isVideo ? null : asset.uri;
  if (isVideo) {
    try {
      thumbUri = (await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0, quality: 0.6 })).uri;
      patchUp(pid, key, { thumb: thumbUri });
    } catch {
      thumbUri = null;
    }
  }
  try {
    const folder = kind === 'clip' ? 'footage' : 'references';
    const path = `${pid}/${folder}/${Date.now()}-${safeFileName(name)}`;
    const task = uploadWithProgress({ path, uri: asset.uri, name, mimeType, onProgress: (percent) => patchUp(pid, key, { percent }) });
    patchUp(pid, key, { task });
    await task.done;
    let thumbPath: string | null = isVideo ? null : path;
    if (isVideo && thumbUri) {
      thumbPath = `${pid}/thumbs/${Date.now()}.jpg`;
      await uploadWithProgress({ path: thumbPath, uri: thumbUri, name: 'thumb.jpg', mimeType: 'image/jpeg' }).done.catch(() => (thumbPath = null));
    }
    const { data, error } = await supabase
      .from('footage')
      .insert({
        project_id: pid,
        kind,
        title: name,
        file_path: path,
        size_bytes: asset.fileSize ?? null,
        duration_seconds: asset.duration ? asset.duration / 1000 : null,
        mime_type: mimeType,
        thumb_path: thumbPath,
        added_by: uid,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    set(pid, { rows: [...get(pid).rows, data as FileRow], ups: get(pid).ups.filter((u) => u.key !== key) });
    return true;
  } catch (e) {
    if (e instanceof UploadError && e.message === 'Cancelled') return false;
    const tooBig = e instanceof UploadError && e.tooBig;
    patchUp(pid, key, { state: 'error', task: undefined, meta: tooBig ? 'Too big to upload here · try a shorter clip or a link' : "Couldn't upload · check your connection" });
    return false;
  }
}

/** "Paste a link". Returns an error line, or null when it's saved. */
export async function addLink(pid: string, kind: FileKind, url: string, me: { id?: string; name: string }) {
  const src = linkSource(url);
  const key = newKey();
  set(pid, { ups: [...get(pid).ups, { key, kind, name: kind === 'clip' ? `${src} folder` : src, thumb: null, percent: 40, state: 'up', meta: `from ${src}` }] });
  const { data, error } = await supabase
    .from('footage')
    .insert({ project_id: pid, kind, title: kind === 'clip' ? `${src} folder` : src, link_url: url, added_by: me.id })
    .select(COLS)
    .single();
  if (error) {
    patchUp(pid, key, { state: 'error', meta: "Couldn't save the link · check your connection" });
    return "Couldn't save the link";
  }
  set(pid, { rows: [...get(pid).rows, data as FileRow], ups: get(pid).ups.filter((u) => u.key !== key) });
  if (kind === 'clip') await logActivity({ project_id: pid, by_key: 'M', title: `New footage from ${me.name}`, body: `${src} link added`, unread: false });
  return null;
}

/** Cancel or clear an upload that's still in the list. */
export function dropUpload(pid: string, key: string) {
  get(pid).ups.find((u) => u.key === key)?.task?.cancel();
  set(pid, { ups: get(pid).ups.filter((u) => u.key !== key) });
}

/* ---------- remove (swipe left) ---------- */

/** Removes the row and its files. Returns an error line, or null. */
export async function removeFile(pid: string, row: FileRow) {
  const before = get(pid).rows;
  set(pid, { rows: before.filter((r) => r.id !== row.id) });
  // RLS quietly skips rows you didn't add, so check something was really removed.
  const { data, error } = await supabase.from('footage').delete().eq('id', row.id).select('id');
  if (error || !data?.length) {
    set(pid, { rows: before });
    return "Couldn't remove it · only the person who added it can";
  }
  await removeFiles([row.file_path, row.thumb_path !== row.file_path ? row.thumb_path : null]);
  return null;
}
