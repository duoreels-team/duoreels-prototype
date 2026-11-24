/**
 * Versions + notes per project, shared by the review screen and its sheets
 * (sheets render above the screen, so they read from here, not from props).
 * Every change is saved to Supabase; the screen updates first.
 */
import { useSyncExternalStore } from 'react';

import { fetchReview, type Note, type Version } from '@/lib/review';
import { supabase } from '@/lib/supabase';

export type ReviewData = { status: 'loading' | 'ready' | 'error'; versions: Version[]; notes: Note[] };

const EMPTY: ReviewData = { status: 'loading', versions: [], notes: [] };
const store = new Map<string, ReviewData>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(id: string, next: ReviewData) {
  store.set(id, next);
  emit();
}

export function getReview(id: string) {
  return store.get(id) ?? EMPTY;
}

export function useReviewData(id: string | undefined) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (id ? getReview(id) : EMPTY),
  );
}

export async function loadReview(id: string) {
  const res = await fetchReview(id);
  if ('error' in res && res.error) {
    set(id, { ...getReview(id), status: getReview(id).versions.length ? 'ready' : 'error' });
    return;
  }
  set(id, { status: 'ready', versions: res.versions ?? [], notes: res.notes ?? [] });
}

/* ---------- notes ---------- */

const NOTE_COLS =
  'id, version_id, time_seconds, end_seconds, body, kind, status, done, by_key, drawing_svg, audio_path, reply_text, reply_by_key, created_at';

export async function addNote(projectId: string, fields: Partial<Note> & { version_id: string; time_seconds: number; body: string }) {
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('notes')
    .insert({ author_id: user.user?.id, status: 'draft', by_key: 'M', kind: 'text', ...fields })
    .select(NOTE_COLS)
    .single<Note>();
  if (error || !data) return null;
  const note = { ...data, time_seconds: Number(data.time_seconds), end_seconds: data.end_seconds === null ? null : Number(data.end_seconds) };
  const cur = getReview(projectId);
  set(projectId, { ...cur, notes: [...cur.notes, note].sort((a, b) => a.time_seconds - b.time_seconds) });
  return note;
}

export async function updateNotes(projectId: string, ids: string[], fields: Partial<Note>) {
  const cur = getReview(projectId);
  const before = cur.notes;
  set(projectId, { ...cur, notes: cur.notes.map((n) => (ids.includes(n.id) ? { ...n, ...fields } : n)) });
  const { error } = await supabase.from('notes').update(fields).in('id', ids);
  if (error) {
    set(projectId, { ...getReview(projectId), notes: before });
    return false;
  }
  return true;
}

/** Hide now, delete for real after the Undo toast is gone. */
export function deleteNoteLater(projectId: string, id: string, delayMs = 3200) {
  const cur = getReview(projectId);
  const note = cur.notes.find((n) => n.id === id);
  set(projectId, { ...cur, notes: cur.notes.filter((n) => n.id !== id) });
  const timer = setTimeout(() => {
    supabase.from('notes').delete().eq('id', id);
  }, delayMs);
  return () => {
    clearTimeout(timer);
    if (note) {
      const now = getReview(projectId);
      set(projectId, { ...now, notes: [...now.notes, note].sort((a, b) => a.time_seconds - b.time_seconds) });
    }
  };
}

/* ---------- views of the data (prototype p.drafts / p.all / p.pins) ---------- */

export function currentVersion(d: ReviewData) {
  return d.versions[d.versions.length - 1] ?? null;
}

export function versionNumber(d: ReviewData, versionId: string) {
  return d.versions.find((v) => v.id === versionId)?.number ?? 0;
}

/** Your unsent notes on the current version. */
export function drafts(d: ReviewData) {
  const cur = currentVersion(d);
  return cur ? d.notes.filter((n) => n.version_id === cur.id && n.status === 'draft' && n.by_key === 'M') : [];
}

/** Every sent note, all versions (not the editor's bare pins). */
export function sentNotes(d: ReviewData) {
  return d.notes.filter((n) => n.status === 'sent' && n.kind !== 'pin');
}

/** Pins on the timeline: your notes and the editor's pins on the current version. */
export function pins(d: ReviewData) {
  const cur = currentVersion(d);
  if (!cur) return [];
  return d.notes.filter((n) => n.version_id === cur.id && (n.by_key === 'M' || n.kind === 'pin')).map((n) => ({ t: n.time_seconds, by: n.by_key }));
}
