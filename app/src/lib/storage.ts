/**
 * Files in the private "project-files" bucket (always under "<project id>/…").
 */
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export const BUCKET = 'project-files';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export type UploadTask = {
  /** Resolves with the stored path once the whole file is up. */
  done: Promise<string>;
  cancel: () => void;
};

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly tooBig = false,
  ) {
    super(message);
  }
}

/** "My Clip (1).MOV" → "My-Clip-1.MOV" */
export function safeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'file';
}

/**
 * Upload a local file (photo library, recording…) with real progress.
 * supabase-js can't report progress, so this talks to the Storage API directly
 * with the signed-in user's token (never a secret key).
 */
export function uploadWithProgress(opts: {
  path: string;
  uri: string;
  name: string;
  mimeType: string;
  onProgress?: (percent: number) => void;
}): UploadTask {
  const xhr = new XMLHttpRequest();
  let cancelled = false;

  const done = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new UploadError('Not signed in');
    if (cancelled) throw new UploadError('Cancelled');

    return new Promise<string>((resolve, reject) => {
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${opts.path.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', SUPABASE_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          opts.onProgress?.(100);
          resolve(opts.path);
        } else {
          const tooBig = xhr.status === 413 || /maximum allowed size|too large|exceeded/i.test(xhr.responseText);
          reject(new UploadError(xhr.responseText || `Upload failed (${xhr.status})`, tooBig));
        }
      };
      xhr.onerror = () => reject(new UploadError('Network error'));
      xhr.onabort = () => reject(new UploadError('Cancelled'));

      const form = new FormData();
      form.append('cacheControl', '3600');
      // React Native reads the file from its uri.
      form.append('', { uri: opts.uri, name: opts.name, type: opts.mimeType } as unknown as Blob);
      xhr.send(form);
    });
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      try {
        xhr.abort();
      } catch {
        // not started yet
      }
    },
  };
}

export async function removeFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}

/* ---------- show a private file: short-lived signed link, cached ---------- */

const signed = new Map<string, { url: string; until: number }>();

export async function signedUrl(path: string) {
  const hit = signed.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  signed.set(path, { url: data.signedUrl, until: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

function cachedUrl(path: string | null | undefined) {
  const hit = path ? signed.get(path) : undefined;
  return hit && hit.until > Date.now() ? hit.url : null;
}

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => cachedUrl(path));
  useEffect(() => {
    let live = true;
    if (!path) return;
    signedUrl(path).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [path]);
  return path ? url : null;
}
