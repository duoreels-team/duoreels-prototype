/**
 * Versions, notes, activity and messages — the data behind the review flow.
 */
import type { ImageSource } from 'expo-image';

import { person } from '@/lib/people';
import { dotDate, editorName, type Project } from '@/lib/projects';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { signedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type Version = {
  id: string;
  project_id: string;
  number: number;
  video_path: string;
  thumb_path: string | null;
  media_kind: 'video' | 'image';
  duration_seconds: number | null;
  by_key: string | null;
  created_at: string;
};

export type NoteKind = 'text' | 'voice' | 'draw' | 'range' | 'image' | 'pin';

export type Note = {
  id: string;
  version_id: string;
  time_seconds: number;
  end_seconds: number | null;
  body: string;
  kind: NoteKind;
  status: 'draft' | 'sent';
  done: boolean;
  by_key: string;
  drawing_svg: string | null;
  /** The drawing as a PNG in "project-files". */
  drawing_path: string | null;
  audio_path: string | null;
  /** A picture from Photos or Files, in "project-files". */
  image_path: string | null;
  link_url: string | null;
  reply_text: string | null;
  reply_by_key: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  project_id: string | null;
  by_key: string;
  title: string;
  body: string;
  tag: string | null;
  tag_tone: string | null;
  action: 'review' | 'ask' | 'thread' | null;
  unread: boolean;
  created_at: string;
};

export type Message = { id: string; editor_key: string; from_me: boolean; body: string; created_at: string };

const VERSION_COLS = 'id, project_id, number, video_path, thumb_path, media_kind, duration_seconds, by_key, created_at';
const NOTE_COLS =
  'id, version_id, time_seconds, end_seconds, body, kind, status, done, by_key, drawing_svg, drawing_path, audio_path, image_path, link_url, reply_text, reply_by_key, created_at';

export async function fetchReview(projectId: string) {
  const versions = await supabase.from('versions').select(VERSION_COLS).eq('project_id', projectId).order('number').returns<Version[]>();
  if (versions.error) return { error: versions.error };
  const ids = (versions.data ?? []).map((v) => v.id);
  const notes = ids.length
    ? await supabase.from('notes').select(NOTE_COLS).in('version_id', ids).order('time_seconds').returns<Note[]>()
    : { data: [] as Note[], error: null };
  if (notes.error) return { error: notes.error };
  return {
    versions: versions.data ?? [],
    notes: (notes.data ?? []).map((n) => ({ ...n, time_seconds: Number(n.time_seconds), end_seconds: n.end_seconds === null ? null : Number(n.end_seconds) })),
  };
}

export async function fetchActivity() {
  return supabase
    .from('activity')
    .select('id, project_id, by_key, title, body, tag, tag_tone, action, unread, created_at')
    .order('created_at', { ascending: false })
    .returns<Activity[]>();
}

/* ---------- what a version shows ---------- */

/** Picture for a version: a sample photo, or a file in Storage. */
export async function versionPicture(v: Pick<Version, 'thumb_path' | 'video_path' | 'media_kind'>): Promise<ImageSource | null> {
  const path = v.thumb_path ?? (v.media_kind === 'image' ? v.video_path : null);
  if (!path) return null;
  if (path.startsWith('sample:')) return SAMPLE_IMAGES[path.slice(7) as keyof typeof SAMPLE_IMAGES] ?? null;
  const url = await signedUrl(path);
  return url ? { uri: url } : null;
}

export async function versionVideoUrl(v: Pick<Version, 'video_path' | 'media_kind'>) {
  if (v.media_kind !== 'video' || v.video_path.startsWith('sample:')) return null;
  return signedUrl(v.video_path);
}

/* ---------- formatting (prototype fmt / fmtR / relative times) ---------- */

export function fmt(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtRange(n: Pick<Note, 'time_seconds' | 'end_seconds'>) {
  return n.end_seconds ? `${fmt(n.time_seconds)}–${fmt(n.end_seconds)}` : fmt(n.time_seconds);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Oct 28" */
export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Inbox time: "now", "2h", "Yesterday", "Mon", "Oct 30". */
export function inboxTime(iso: string) {
  const d = new Date(iso);
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 60) return 'now';
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 48) return 'Yesterday';
  if (mins < 60 * 24 * 6) return DAYS[d.getDay()];
  return shortDate(iso);
}

/* ---------- money (payment split from New project) ---------- */

export function money(p: Pick<Project, 'price' | 'upfront_percent'>) {
  const price = p.price ?? 75;
  const now = Math.round((price * p.upfront_percent) / 100);
  return { price, now, onApproval: price - now, fee: (price * 0.05).toFixed(2) };
}

/* ---------- dates for the extra-day ask ---------- */

export function addDays(iso: string | null, n: number) {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function fullWeekday(iso: string | null) {
  if (!iso) return '';
  return FULL_DAYS[new Date(`${iso.slice(0, 10)}T12:00:00`).getDay()];
}

/* ---------- state helpers (prototype canNoteP) ---------- */

export function canNote(p: Project) {
  return p.turn === 'me' && p.status !== 'done' && p.current_version > 0 && !p.asks_extra_day;
}

export function reviewSubtitle(p: Project) {
  const ed = editorName(p);
  if (p.status === 'done') return `Done · v${p.current_version} is final`;
  if (!p.current_version) return `Waiting for v1 · round 1 of ${p.rounds}`;
  if (canNote(p)) return `Your turn · v${p.current_version} · round ${p.round} of ${p.rounds}`;
  if (p.asks_extra_day) return `${ed} wants until ${dotDate(addDays(p.due_date, 1))} · v${p.current_version}`;
  return `Waiting on ${ed} · v${p.current_version} · round ${p.round} of ${p.rounds}`;
}

export function whoKey(p: Project) {
  return canNote(p) ? 'M' : (p.editor_keys[0] ?? 'L');
}

export const EDITOR_LAST: Record<string, string> = { L: 'Park', S: 'Kim', J: 'Diaz' };

export function editorFull(k: string) {
  const last = EDITOR_LAST[k];
  return `${person(k).name}${last ? ` ${last}` : ''}`;
}
