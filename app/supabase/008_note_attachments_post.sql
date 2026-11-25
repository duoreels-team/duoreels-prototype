-- 008 · Note attachments + your own post text
-- Run once in Supabase → SQL Editor, after 007. Safe to run again.
--
--  • notes: an image (from Photos or Files), a link, and the drawing as a PNG
--    (all files live in the "project-files" bucket under the project's id).
--    audio_path (voice clip) and drawing_svg already exist.
--  • projects: hashtags for Post (title = cover_title, caption = caption).

alter table public.notes
  add column if not exists image_path   text,
  add column if not exists link_url     text check (link_url is null or link_url ~* '^https?://'),
  add column if not exists drawing_path text;

alter table public.projects
  add column if not exists hashtags text;

grant update (hashtags) on public.projects to authenticated;
