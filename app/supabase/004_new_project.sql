-- 004 · New project
-- Run once in Supabase → SQL Editor, after 003. Safe to run again.
--
--  • projects.is_draft — a project you're still setting up (clips upload into it
--    before you press "Send invite"). Home doesn't show drafts.
--  • projects.brief_audio_path — the voice brief you recorded.
--  • footage: kind (clip or reference), file size, length, type and a thumbnail.
--  • invites: can be for a demo editor (no email yet) and carry a short link code.

alter table public.projects
  add column if not exists is_draft         boolean not null default false,
  add column if not exists brief_audio_path text;

grant update (is_draft, brief_audio_path) on public.projects to authenticated;

alter table public.footage
  add column if not exists kind             text    not null default 'clip' check (kind in ('clip', 'reference')),
  add column if not exists size_bytes       bigint,
  add column if not exists duration_seconds numeric(10, 3),
  add column if not exists mime_type        text,
  add column if not exists thumb_path       text;  -- small picture in the "project-files" bucket

alter table public.invites
  alter column email drop not null,
  add column if not exists editor_key text,      -- demo editor (L = Leo, S = Sara …) until a real person joins
  add column if not exists code       text not null default substr(md5(gen_random_uuid()::text), 1, 3);
