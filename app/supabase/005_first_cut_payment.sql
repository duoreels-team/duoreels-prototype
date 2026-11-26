-- 005 · First cut + payment split
-- Run once in Supabase → SQL Editor, after 004. Safe to run again.
--
--  • projects.first_cut_at — when the first cut is due (date + time).
--    projects.due_date keeps the day, so Home's "due 11.27" follows it.
--  • projects.upfront_percent — how much is paid up front (0–100).
--    The rest (100 − upfront_percent) is paid on approval.

alter table public.projects
  add column if not exists first_cut_at    timestamptz,
  add column if not exists upfront_percent int not null default 50
    check (upfront_percent between 0 and 100);

grant update (first_cut_at, upfront_percent) on public.projects to authenticated;
