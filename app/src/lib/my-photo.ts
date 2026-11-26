/**
 * Your photo, shown the moment you pick it (before the upload finishes),
 * so every "M" avatar updates at once. Cleared when the saved profile has it.
 */
import * as ImagePicker from 'expo-image-picker';
import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

let pending: string | null = null;
const listeners = new Set<() => void>();

function set(v: string | null) {
  pending = v;
  listeners.forEach((l) => l());
}

export function usePendingPhoto() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
}

let picking = false;

/**
 * Tap → the photo library opens straight away (nothing awaited first),
 * square crop, shown at once, then uploaded to "avatars" and saved on your profile.
 * Extra taps while the picker is open are ignored.
 */
export async function changeMyPhoto(userId: string, onSaved: () => Promise<void> | void, onError: (msg: string) => void) {
  if (picking) return;
  picking = true;
  let asset: ImagePicker.ImagePickerAsset | undefined;
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (r.canceled) return;
    asset = r.assets[0];
  } finally {
    picking = false;
  }
  if (!asset) return;
  set(asset.uri);
  try {
    const type = asset.mimeType ?? 'image/jpeg';
    const path = `${userId}/${Date.now()}.${type.includes('png') ? 'png' : 'jpg'}`;
    const body = await (await fetch(asset.uri)).arrayBuffer();
    const up = await supabase.storage.from('avatars').upload(path, body, { contentType: type });
    if (up.error) throw up.error;
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const saved = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (saved.error) throw saved.error;
    await onSaved();
    set(null);
  } catch {
    set(null);
    onError("Couldn't save your photo · try again");
  }
}
