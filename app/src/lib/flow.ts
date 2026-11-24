/**
 * What happens to a project as it moves along — saved in Supabase.
 * The editor's side is a demo (prototype simUpload / simAsk) until editors are real people.
 */
import { isoDay } from '@/lib/dates';
import { editorName, type Project } from '@/lib/projects';
import { addDays, money, type Note } from '@/lib/review';
import { supabase } from '@/lib/supabase';

type Result = { error: string | null };

function friendly(e: { message?: string } | null | undefined): string {
  if (!e) return "Couldn't save that. Try again.";
  return /network|fetch/i.test(e.message ?? '') ? "Can't reach Duoreels. Check your connection." : "Couldn't save that. Try again.";
}

/* ---------- the editor uploads the next version (simUpload) ---------- */

export type VersionMedia = { video_path: string; thumb_path: string | null; media_kind: 'video' | 'image'; duration_seconds: number };

export async function simUpload(p: Project, given?: VersionMedia, whatChanged?: string): Promise<Result & { v?: number }> {
  const ed = p.editor_keys[0] ?? 'L';
  const v = Math.min(p.current_version + 1, 9);

  // The demo video: the first clip you uploaded in New project (a video if there is one).
  const { data: clips } = await supabase
    .from('footage')
    .select('file_path, thumb_path, mime_type, duration_seconds')
    .eq('project_id', p.id)
    .eq('kind', 'clip')
    .not('file_path', 'is', null)
    .order('created_at');
  const video = (clips ?? []).find((c) => c.mime_type?.startsWith('video/'));
  const photo = (clips ?? []).find((c) => c.mime_type?.startsWith('image/'));
  const fallback = p.cover_image?.startsWith('sample:') ? p.cover_image : 'sample:s23';
  const media: VersionMedia = given ?? (video
    ? { video_path: video.file_path!, thumb_path: video.thumb_path, media_kind: 'video', duration_seconds: Number(video.duration_seconds) || p.duration_seconds || 30 }
    : photo
      ? { video_path: photo.file_path!, thumb_path: photo.file_path, media_kind: 'image', duration_seconds: p.duration_seconds || 30 }
      : { video_path: fallback, thumb_path: fallback, media_kind: 'image', duration_seconds: p.duration_seconds || 30 });

  const { data: user } = await supabase.auth.getUser();
  const inserted = await supabase
    .from('versions')
    .insert({ project_id: p.id, number: v, uploaded_by: user.user?.id, by_key: ed, ...media })
    .select('id')
    .single();
  if (inserted.error) return { error: friendly(inserted.error) };

  const dur = Math.round(media.duration_seconds);
  const upd = await supabase
    .from('projects')
    .update({
      status: 'in_progress',
      done_kind: null,
      current_version: v,
      rounds: Math.max(p.rounds, v),
      round: v,
      new_version: true,
      asks_extra_day: false,
      turn: 'me',
      duration_seconds: dur,
    })
    .eq('id', p.id);
  if (upd.error) return { error: friendly(upd.error) };

  if (v > 1) {
    // Your earlier notes come back answered (prototype: "Fixed in vN").
    const { data: older } = await supabase.from('versions').select('id').eq('project_id', p.id).lt('number', v);
    const olderIds = (older ?? []).map((x) => x.id);
    if (olderIds.length) {
      await supabase
        .from('notes')
        .update({ reply_text: `Fixed in v${v}.`, reply_by_key: ed })
        .in('version_id', olderIds)
        .eq('by_key', 'M')
        .eq('status', 'sent')
        .is('reply_text', null);
    }
  }

  await supabase.from('activity').insert({
    project_id: p.id,
    by_key: ed,
    title: `${editorName(p)} uploaded v${v}`,
    body: whatChanged?.trim() ? `v${v} is up. ${whatChanged.trim()}` : `v${v} is up. Take a look when you can.`,
    tag: `NEW V${v} · REVIEW`,
    tag_tone: 'violet',
    action: 'review',
  });
  return { error: null, v };
}

/* ---------- the editor asks for one more day (simAsk) ---------- */

export async function simAsk(p: Project): Promise<Result> {
  const ed = p.editor_keys[0] ?? 'L';
  const upd = await supabase.from('projects').update({ asks_extra_day: true, turn: 'me' }).eq('id', p.id);
  if (upd.error) return { error: friendly(upd.error) };
  const due = p.due_date ?? isoDay(new Date());
  await supabase.from('activity').insert({
    project_id: p.id,
    by_key: ed,
    title: `${editorName(p)} asks for 1 more day`,
    body: 'Could I have one more day? Want to redo the colour.',
    tag: `REPLY BY ${Number(due.slice(5, 7))}.${Number(due.slice(8, 10))}`,
    tag_tone: 'yellow',
    action: 'ask',
  });
  return { error: null };
}

/** Accept: the due date moves one day (and the first cut too, if v1 isn't in yet). */
export function askYesFields(p: Project) {
  const due = addDays(p.due_date, 1);
  const fields: Partial<Project> = { asks_extra_day: false, turn: 'them', due_date: due };
  if (!p.current_version && p.first_cut_at) {
    const d = new Date(p.first_cut_at);
    d.setDate(d.getDate() + 1);
    fields.first_cut_at = d.toISOString();
  }
  return fields;
}

export async function markProjectRead(projectId: string) {
  await supabase.from('activity').update({ unread: false }).eq('project_id', projectId).eq('unread', true);
}

export async function logActivity(row: { project_id: string | null; by_key: string; title: string; body: string; tag?: string; tag_tone?: string; unread?: boolean }) {
  await supabase.from('activity').insert({ action: 'review', unread: false, ...row });
}

/* ---------- send your notes (sendNotes) ---------- */

export async function sendNotes(p: Project, drafts: Note[]): Promise<Result> {
  if (!drafts.length) return { error: null };
  const n = await supabase.from('notes').update({ status: 'sent' }).in('id', drafts.map((d) => d.id));
  if (n.error) return { error: friendly(n.error) };
  const u = await supabase.from('projects').update({ new_version: false, turn: 'them' }).eq('id', p.id);
  if (u.error) return { error: friendly(u.error) };
  await markProjectRead(p.id);
  return { error: null };
}

export async function unsendNotes(p: Project, drafts: Note[]) {
  await supabase.from('notes').update({ status: 'draft' }).in('id', drafts.map((d) => d.id));
  await supabase.from('projects').update({ new_version: true, turn: 'me' }).eq('id', p.id);
}

/* ---------- approve (approveYes) ---------- */

export async function approve(p: Project): Promise<Result> {
  const u = await supabase
    .from('projects')
    .update({ status: 'done', done_kind: 'done', new_version: false, turn: 'them', finished_at: isoDay(new Date()), approved_at: new Date().toISOString() })
    .eq('id', p.id);
  if (u.error) return { error: friendly(u.error) };
  await markProjectRead(p.id);
  await logActivity({
    project_id: p.id,
    by_key: 'M',
    title: `You approved ${p.name}`,
    body: `You approved it · $${money(p).onApproval} released to ${editorName(p)}`,
    tag: 'DONE',
    tag_tone: 'grey',
  });
  return { error: null };
}
