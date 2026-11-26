-- 011 · Your own project types ("+ New type" on New project).
-- Saved on your profile, shown after the built-in types and in the Marketplace filter.
-- Safe to run more than once.

alter table public.profiles
  add column if not exists my_types text[] not null default '{}';
