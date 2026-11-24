-- 009 · Marketplace, Me and the editor view
-- Run once in Supabase → SQL Editor, after 008. Safe to run again.
--
--  • editors + editor_reviews: the prototype's Marketplace editors (EDS) as real rows
--  • saved_editors: editors you hearted
--  • profiles: city, bio, plan (+ Studio trial), AI credits, notification settings
--  • ai_usage: what used AI credits
--  • brief_templates: your saved briefs
--  • accept_demo_invite(): in the editor view you play the demo editor, so you can
--    accept an invite you sent to "Leo" yourself
--  • my_storage(): real file sizes in "project-files" for your projects

-- ── Marketplace editors ────────────────────────────────────────
create table if not exists public.editors (
  key        text primary key,          -- 'L', 'S', 'J' (same letters as the demo editors)
  name       text not null,
  stars      numeric(2, 1) not null,
  style      text not null,
  tags       text[] not null default '{}', -- used by search + filter
  price      int not null,              -- "from", Short (≤ 60 s · 2 rounds); Long = price + 80
  projects   int not null default 0,
  reels      text[] not null default '{}', -- sample photo keys
  durations  text[] not null default '{}',
  sort       int not null default 0
);

create table if not exists public.editor_reviews (
  id          uuid primary key default gen_random_uuid(),
  editor_key  text not null references public.editors (key) on delete cascade,
  name        text not null,
  initial     text not null,
  color       text not null,
  stars       int not null check (stars between 1 and 5),
  date_label  text not null,
  body        text not null,
  project     text not null,
  sort        int not null default 0
);

alter table public.editors enable row level security;
alter table public.editor_reviews enable row level security;
revoke all on public.editors, public.editor_reviews from anon;
grant select on public.editors, public.editor_reviews to authenticated;
drop policy if exists "Everyone signed in sees editors" on public.editors;
create policy "Everyone signed in sees editors" on public.editors for select to authenticated using (true);
drop policy if exists "Everyone signed in sees reviews" on public.editor_reviews;
create policy "Everyone signed in sees reviews" on public.editor_reviews for select to authenticated using (true);

insert into public.editors (key, name, stars, style, tags, price, projects, reels, durations, sort) values
  ('L', 'Leo Park', 4.9, 'Reels · vlogs', '{Vlog,Travel,Food}', 60, 31, '{rL1,rL2,rL3,rL4,rL5,rL6}', '{0:28,0:45,0:33,0:19,0:38,0:24}', 1),
  ('S', 'Sara Kim', 4.7, 'Talking head', '{"Talking head"}',     75, 8,  '{rS1,rS2,rS3,rS4,rS5,rS6}', '{0:52,1:10,0:41,0:36,0:29,0:58}', 2),
  ('J', 'Jon Diaz', 5.0, 'Product ads',  '{Product,Food}',       90, 14, '{rJ1,rJ2,rJ3,rJ4,rJ5,rJ6}', '{0:15,0:22,0:18,0:30,0:26,0:20}', 3)
on conflict (key) do update set name = excluded.name, stars = excluded.stars, style = excluded.style, tags = excluded.tags,
  price = excluded.price, projects = excluded.projects, reels = excluded.reels, durations = excluded.durations, sort = excluded.sort;

delete from public.editor_reviews;
insert into public.editor_reviews (editor_key, name, initial, color, stars, date_label, body, project, sort) values
  ('L', 'Maya', 'M', '#8E6CFF', 5, 'Oct 30', 'Third project with Leo. He gets my pacing without me explaining it, and the captions are always clean.', 'Latte afternoon', 1),
  ('L', 'Priya R.', 'P', '#2EC4B6', 5, 'Oct 22', 'Turned 2 hours of messy night-market footage into a 35 s reel that actually feels like being there.', 'Street food tour', 2),
  ('L', 'Daniel O.', 'D', '#FF9A4D', 5, 'Oct 15', 'Fast, kind, and fixed every note in one round. My grandpa cried watching it.', 'Dumpling day', 3),
  ('L', 'Hana K.', 'H', '#3D8BFF', 4, 'Oct 3', 'Great edit. v1 came a day late but he told me early, so no stress.', 'Coast drive', 4),
  ('L', 'Rosa M.', 'R', '#FFC94D', 5, 'Sep 27', 'Funny, warm cut of my thrift haul. Views tripled compared to my own edits.', 'Thrift Saturday', 5),
  ('L', 'Tom & June', 'T', '#3DE0A0', 5, 'Sep 12', 'Made our anniversary kitchen dance into something we will keep forever.', 'Kitchen dance', 6),
  ('L', 'Alex W.', 'A', '#8E6CFF', 5, 'Aug 30', 'Clear on price and rounds from day one. Would book again.', 'Moving vlog', 7),
  ('L', 'Sam T.', 'S', '#FF9A4D', 4, 'Aug 18', 'Colour grade was a bit warm for me, but he changed it right away.', 'Beach day', 8),
  ('L', 'Lena B.', 'L', '#2EC4B6', 5, 'Aug 2', 'Best edit I have paid for. Music choice was perfect.', 'Paris weekend', 9),
  ('S', 'Marcus J.', 'M', '#3D8BFF', 5, 'Oct 28', 'She cut my 40 min podcast into five clips that each stand on their own. Smart choices on what to keep.', 'Podcast clips', 1),
  ('S', 'Linda H.', 'L', '#3DE0A0', 5, 'Oct 9', 'Patient with an old lady who doesn’t know what a jump cut is. My garden videos look professional now.', 'Tomato season', 2),
  ('S', 'Omar F.', 'O', '#FF9A4D', 4, 'Sep 20', 'Good captions and pacing. Took 2 rounds to get the hook right.', 'Car talks ep. 4', 3),
  ('J', 'Nia B.', 'N', '#8E6CFF', 5, 'Oct 25', 'Our ceramic pour shot sold out the batch in a weekend. He knows how to make a product feel warm.', 'Pour-over set', 1),
  ('J', 'Meera S.', 'M', '#FFC94D', 5, 'Oct 11', 'Simple, honest soap ad. No fake hype, just my hands and the process. Exactly what I asked for.', 'Soap launch', 2),
  ('J', 'Kenji A.', 'K', '#2EC4B6', 5, 'Sep 30', 'Delivered a day early with three length versions for every platform.', 'Trail pack', 3),
  ('J', 'Brett C.', 'B', '#FF9A4D', 5, 'Sep 14', 'Shot list help before I filmed saved me a reshoot.', 'Camp stove', 4),
  ('J', 'Diego & friends', 'D', '#3D8BFF', 5, 'Aug 28', 'Made a board game night look as fun as it actually was.', 'Game night', 5),
  ('J', 'Vinh T.', 'V', '#3DE0A0', 4, 'Aug 10', 'Clean edit. Wanted more slow-mo, he added it in round 2.', 'Sneaker drop', 6);

-- ── Saved editors ──────────────────────────────────────────────
create table if not exists public.saved_editors (
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  editor_key  text not null references public.editors (key) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (owner_id, editor_key)
);
alter table public.saved_editors enable row level security;
revoke all on public.saved_editors from anon;
grant select, insert, delete on public.saved_editors to authenticated;
drop policy if exists "Own saved editors" on public.saved_editors;
create policy "Own saved editors" on public.saved_editors for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ── Profile: city, bio, plan, credits, notifications ───────────
alter table public.profiles
  add column if not exists city              text,
  add column if not exists bio               text,
  add column if not exists plan              text not null default 'creator' check (plan in ('free', 'creator', 'studio_trial', 'studio')),
  add column if not exists trial_ends_at     timestamptz,
  add column if not exists ai_credits        int not null default 12 check (ai_credits >= 0),
  add column if not exists notify_on         boolean not null default true,
  add column if not exists quiet_start       time not null default '22:00',
  add column if not exists quiet_end         time not null default '08:00',
  add column if not exists notify_versions   boolean not null default true,
  add column if not exists notify_replies    boolean not null default true,
  add column if not exists notify_more_time  boolean not null default true,
  add column if not exists notify_messages   boolean not null default true,
  add column if not exists notify_payments   boolean not null default true;

-- ── AI credits used ────────────────────────────────────────────
create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  action      text not null check (action in ('tidy', 'ai_write', 'translate', 'ai_4k', 'top_up')),
  credits     int not null,               -- negative = used, positive = added
  project_id  uuid references public.projects (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
grant select, insert on public.ai_usage to authenticated;
drop policy if exists "Own AI usage" on public.ai_usage;
create policy "Own AI usage" on public.ai_usage for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ── Brief templates ────────────────────────────────────────────
create table if not exists public.brief_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null,
  brief       text not null default '',
  type        text not null default 'Vlog',
  references_text text not null default '',  -- links, one per line
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.brief_templates enable row level security;
revoke all on public.brief_templates from anon;
grant select, insert, update, delete on public.brief_templates to authenticated;
drop policy if exists "Own templates" on public.brief_templates;
create policy "Own templates" on public.brief_templates for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ── Editor view: accept an invite you sent to a demo editor ────
create or replace function public.accept_demo_invite(invite_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.invites
  set status = 'accepted', accepted_at = now()
  where id = invite_id and status = 'pending' and editor_key is not null
    and public.is_project_owner(project_id);
  if not found then
    raise exception 'Invite not found';
  end if;
end;
$$;
revoke execute on function public.accept_demo_invite(uuid) from public, anon;
grant execute on function public.accept_demo_invite(uuid) to authenticated;

-- ── Storage: real sizes of your project files ──────────────────
create or replace function public.my_storage()
returns table (folder text, bytes bigint) language sql stable security definer set search_path = ''
as $$
  select coalesce((storage.foldername(o.name))[2], 'other') as folder,
         sum(coalesce((o.metadata ->> 'size')::bigint, 0))::bigint as bytes
  from storage.objects o
  where o.bucket_id = 'project-files'
    and public.is_project_member(public.try_uuid((storage.foldername(o.name))[1]))
  group by 1;
$$;
revoke execute on function public.my_storage() from public, anon;
grant execute on function public.my_storage() to authenticated;
