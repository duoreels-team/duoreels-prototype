import type { ImageSource } from 'expo-image';

import { person } from '@/lib/people';
import { SAMPLE_IMAGES } from '@/lib/sample-images';
import { useSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  status: 'in_progress' | 'done';
  brief: string | null;
  cover_image: string | null;
  editor_keys: string[];
  round: number;
  rounds: number;
  current_version: number;
  turn: 'me' | 'them';
  new_version: boolean;
  asks_extra_day: boolean;
  unread_messages: number;
  due_date: string | null;
  price: number | null;
  duration_seconds: number;
  done_kind: 'done' | 'posted' | 'archived' | null;
  finished_at: string | null;
  notifications: boolean;
  is_sample: boolean;
  is_draft: boolean;
  brief_audio_path: string | null;
  /** When the first cut is due (date + time). due_date keeps the day. */
  first_cut_at: string | null;
  /** Paid up front, 0–100. The rest is paid on approval. */
  upfront_percent: number;
  cover_seconds: number | null;
  cover_title: string | null;
  caption: string | null;
  post_apps: string[];
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
};

export const PROJECT_COLUMNS =
  'id, owner_id, name, type, status, brief, cover_image, editor_keys, round, rounds, current_version, turn, new_version, asks_extra_day, unread_messages, due_date, price, duration_seconds, done_kind, finished_at, notifications, is_sample, is_draft, brief_audio_path, first_cut_at, upfront_percent, cover_seconds, cover_title, caption, post_apps, approved_at, posted_at, created_at';

export async function fetchProjects() {
  // Drafts are projects still being set up on "New project": Home doesn't show them.
  return supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('is_draft', false)
    .order('created_at', { ascending: false })
    .returns<Project[]>();
}

/* ---------- small formatters (same as the prototype) ---------- */

/** 84 → "1:24" */
export function mmss(total: number) {
  const t = Math.max(0, Math.round(total || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** "2026-11-28" → "11.28" */
export function dotDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${Number(m)}.${Number(d)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-28" → "Sat" */
export function weekday(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/* ---------- what Home shows (tagFor / verOf / metaLine) ---------- */

export function editorName(p: Project) {
  return person(p.editor_keys[0]).name;
}

export function versionLabel(p: Project) {
  const v = p.current_version;
  if (p.new_version || p.turn === 'me') return v ? `v${v}` : 'v1';
  return v && p.round >= p.rounds ? 'Final' : `v${v + 1}`;
}

export function metaLine(p: Project) {
  return `${versionLabel(p)} · ${editorName(p)} · due ${dotDate(p.due_date)}`;
}

export type TagTone = 'violet' | 'yellow' | 'grey';

export function tagFor(p: Project): [string, TagTone] {
  if (p.status === 'done') return ['DONE', 'grey'];
  if (p.new_version) return [`NEW V${p.current_version}`, 'violet'];
  if (p.asks_extra_day) return [`REPLY BY ${dotDate(p.due_date)}`, 'yellow'];
  if (p.turn === 'me') return [p.unread_messages ? `${p.unread_messages} NEW MESSAGES` : 'YOUR TURN', 'violet'];
  return [`WAITING ON ${editorName(p).toUpperCase()}`, 'grey'];
}

/** Needs you: new version, an editor's question, or your turn. */
export function needsYou(p: Project) {
  return p.new_version || p.asks_extra_day || p.turn === 'me';
}

export function homeOrder(p: Project) {
  return p.new_version ? 0 : p.asks_extra_day ? 1 : p.turn === 'me' ? 2 : 3;
}

/* ---------- cover photo ---------- */

export function coverSource(p: Pick<Project, 'cover_image'>): ImageSource | null {
  const c = p.cover_image;
  if (!c) return null;
  if (c.startsWith('sample:')) {
    return SAMPLE_IMAGES[c.slice(7) as keyof typeof SAMPLE_IMAGES] ?? null;
  }
  if (/^https?:\/\//.test(c)) return { uri: c };
  // A path in the private "project-files" bucket: needs a signed link (see useCover).
  return null;
}

/** The cover as something <Image> can show — sample photo, web link or a file in Storage. */
export function useCover(p: Pick<Project, 'cover_image'>): ImageSource | null {
  const direct = coverSource(p);
  const storagePath = !direct && p.cover_image ? p.cover_image : null;
  const url = useSignedUrl(storagePath);
  return direct ?? (url ? { uri: url } : null);
}
