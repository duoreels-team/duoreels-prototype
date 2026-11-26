-- 006 · Review flow: versions, notes, activity, messages, approve and post
-- Run once in Supabase → SQL Editor, after 005. Safe to run again.
--
--  • versions: length, thumbnail, and where the demo video came from.
--  • notes: kind (text, voice, draw, range, image, pin), draft or sent, done,
--    the editor's reply, a range end, a drawing and a voice recording.
--    Until editors are real people, a note from the demo editor has by_key 'L', 'J' …;
--    your own notes have by_key 'M'.
--  • activity: what shows under the bell (Messages): new versions, requests, chats.
--  • messages: the chat with each demo editor.
--  • projects: cover frame + title, caption, the apps you post to, when it was approved/posted.
--  • The prototype's sample projects get their versions, notes, activity and chats.

-- ── versions ───────────────────────────────────────────────────
alter table public.versions
  add column if not exists duration_seconds numeric(10, 3),
  add column if not exists thumb_path       text,     -- picture in "project-files", or 'sample:<photo>'
  add column if not exists media_kind       text not null default 'video' check (media_kind in ('video', 'image')),
  add column if not exists by_key           text;     -- demo editor who "uploaded" it

-- ── notes ──────────────────────────────────────────────────────
alter table public.notes
  add column if not exists kind         text    not null default 'text'
    check (kind in ('text', 'voice', 'draw', 'range', 'image', 'pin')),
  add column if not exists status       text    not null default 'draft' check (status in ('draft', 'sent')),
  add column if not exists done         boolean not null default false,
  add column if not exists by_key       text    not null default 'M',   -- 'M' = you, 'L' = Leo …
  add column if not exists end_seconds  numeric(10, 3),                 -- Range notes
  add column if not exists drawing_svg  text,                           -- Draw notes: the drawing as an SVG image
  add column if not exists audio_path   text,                           -- Voice notes: recording in "project-files"
  add column if not exists reply_text   text,
  add column if not exists reply_by_key text;

create index if not exists notes_version_status on public.notes (version_id, status);

-- ── projects ───────────────────────────────────────────────────
alter table public.projects
  add column if not exists cover_seconds numeric(10, 3),
  add column if not exists cover_title   text,
  add column if not exists caption       text,
  add column if not exists post_apps     text[] not null default '{TikTok,Reels}',
  add column if not exists approved_at   timestamptz,
  add column if not exists posted_at     timestamptz;

grant update (cover_seconds, cover_title, caption, post_apps, approved_at, posted_at)
on public.projects to authenticated;

-- ── activity (the bell → Messages) ─────────────────────────────
create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete cascade,
  by_key      text not null,                -- who it's from: 'L' = Leo, 'M' = you …
  title       text not null,                -- "Leo uploaded v2"
  body        text not null,                -- "v2 is up. Take a look when you can."
  tag         text,                         -- "NEW V2 · REVIEW", "REPLY BY 11.27", "DONE"
  tag_tone    text,                         -- violet / yellow / grey
  action      text check (action in ('review', 'ask', 'thread')),
  unread      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists activity_owner on public.activity (owner_id, created_at desc);

-- ── messages (chat with a demo editor) ─────────────────────────
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  editor_key  text not null,
  from_me     boolean not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_owner on public.messages (owner_id, editor_key, created_at);

alter table public.activity enable row level security;
alter table public.messages enable row level security;

revoke all on public.activity, public.messages from anon;
grant select, insert, update, delete on public.activity, public.messages to authenticated;

drop policy if exists "Own activity" on public.activity;
create policy "Own activity" on public.activity
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Own messages" on public.messages;
create policy "Own messages" on public.messages
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Sample details: versions, notes, activity and chats for the prototype's
-- sample projects. Runs once per account (profiles.sample_details_at).

alter table public.profiles
  add column if not exists sample_details_at timestamptz;

create or replace function public.add_sample_details(uid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  mr   uuid;
  v3   uuid;
  v2   uuid;
  v1   uuid;
  t0   timestamptz := now();
begin
  update public.profiles set sample_details_at = now()
  where id = uid and sample_details_at is null and samples_added_at is not null;
  if not found then
    return;
  end if;

  -- One version row per cut, showing the sample photo (the prototype has no real video).
  insert into public.versions (project_id, number, video_path, uploaded_by, duration_seconds, thumb_path, media_kind, by_key, created_at)
  select p.id, g.n,
    'sample:' || case when p.cover_image = 'sample:mr' then 'player' else substr(p.cover_image, 8) end,
    uid, p.duration_seconds,
    'sample:' || case when p.cover_image = 'sample:mr' then 'player' else substr(p.cover_image, 8) end,
    'image', p.editor_keys[1],
    t0 - make_interval(days => (p.current_version - g.n) * 5)
  from public.projects p
  cross join lateral generate_series(1, p.current_version) as g(n)
  where p.owner_id = uid and p.is_sample and p.current_version > 0
  on conflict (project_id, number) do nothing;

  -- Morning routine: the prototype's drafts, older notes and pins.
  select id into mr from public.projects where owner_id = uid and is_sample and name = 'Morning routine' limit 1;
  if mr is not null then
    select id into v3 from public.versions where project_id = mr and number = 3;
    select id into v2 from public.versions where project_id = mr and number = 2;
    select id into v1 from public.versions where project_id = mr and number = 1;

    insert into public.notes (version_id, author_id, time_seconds, body, kind, status, by_key, done, reply_text, reply_by_key, created_at) values
      (v3, uid, 3,  'Cut the intro to about 3 seconds.',              'text',  'draft', 'M', false, null, null, t0),
      (v3, uid, 12, 'Slow down the coffee pour — hold 2 s longer.',   'draw',  'draft', 'M', false, null, null, t0),
      (v3, uid, 31, 'Use this kind of ending shot.',                  'image', 'draft', 'M', false, null, null, t0),
      (v3, uid, 22, 'Hold on the light',                              'pin',   'sent',  'L', false, null, null, t0),
      (v3, uid, 30, 'Swap the outro music for something calmer?',     'text',  'sent',  'L', false, null, null, t0 - interval '1 hour'),
      (v2, uid, 3,  'Cut the first 3 s, start on the coffee.',        'text',  'sent',  'M', false, 'Done — it opens on the pour now.', 'L', t0 - interval '5 days'),
      (v2, uid, 5,  'Hold the hook text one beat longer.',            'text',  'sent',  'M', false, null, null, t0 - interval '5 days'),
      (v1, uid, 18, 'Brighter grade on the window shots.',            'text',  'sent',  'M', true,  null, null, t0 - interval '10 days'),
      (v1, uid, 40, 'End on the croissant, not the laptop.',          'text',  'sent',  'M', true,  null, null, t0 - interval '10 days');
  end if;

  -- Café opening: Leo's pin at 0:08.
  insert into public.notes (version_id, author_id, time_seconds, body, kind, status, by_key)
  select v.id, uid, 8, 'Hold on the light', 'pin', 'sent', 'L'
  from public.versions v join public.projects p on p.id = v.project_id
  where p.owner_id = uid and p.is_sample and p.name = 'Café opening' and v.number = 1;

  -- The bell → Messages, newest first (prototype S.inbox).
  insert into public.activity (owner_id, project_id, by_key, title, body, tag, tag_tone, action, unread, created_at)
  select uid, (select id from public.projects where owner_id = uid and is_sample and name = a.proj limit 1),
    a.by_key, a.title, a.body, a.tag, a.tone, a.action, a.unread, t0 - a.ago
  from (values
    ('L', 'Morning routine',  'Leo uploaded v3',            'v3 is up. Tightened the intro and swapped the music.',  'NEW V3 · REVIEW', 'violet', 'review', true,  interval '2 hours'),
    ('L', 'Café opening',     'Leo asks for 1 more day',    'Could I have one more day for the colour pass?',         'REPLY BY ' || to_char(date_trunc('week', current_date)::date + 4, 'FMMM.FMDD'), 'yellow', 'ask', true, interval '3 hours'),
    ('S', null,               'Sara Kim',                   'Yes, I can do 2 days for $75.',                          null, null, 'thread', true,  interval '5 hours'),
    ('J', 'Product unboxing', 'Jon started editing',        'Started editing. First cut by Mon.',                     null, null, 'review', false, interval '1 day'),
    ('L', 'Wedding teaser',   'Leo sent 2 questions',       'Two quick questions about the vows part.',               null, null, 'review', false, interval '2 days'),
    ('M', 'Latte afternoon',  'You approved Latte afternoon','You approved it · $45 released to Leo',                  'DONE', 'grey', 'review', false, interval '24 days')
  ) as a(by_key, proj, title, body, tag, tone, action, unread, ago);

  -- Chats (prototype S.msgs).
  insert into public.messages (owner_id, editor_key, from_me, body, created_at) values
    (uid, 'L', false, 'Hey Maya! Got the footage, starting tonight.', t0 - interval '3 days'),
    (uid, 'L', true,  'Amazing, thank you 🙏',                        t0 - interval '3 days' + interval '2 minutes'),
    (uid, 'L', false, 'Sent you my storefront link.',                  t0 - interval '3 days' + interval '5 minutes'),
    (uid, 'S', false, 'Yes, I can do 2 days for $75.',                 t0 - interval '5 hours'),
    (uid, 'J', false, 'You hired Jon · Product unboxing',              t0 - interval '1 day');
end;
$$;

revoke execute on function public.add_sample_details(uuid) from public, anon, authenticated;

-- New accounts: add_sample_projects now adds the details too.
create or replace function public.add_sample_details_for_me()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  perform public.add_sample_details(auth.uid());
end;
$$;

revoke execute on function public.add_sample_details_for_me() from public, anon;
grant execute on function public.add_sample_details_for_me() to authenticated;

-- Accounts that already have the sample projects get their details now.
do $$
declare r record;
begin
  for r in select id from public.profiles where samples_added_at is not null and sample_details_at is null loop
    perform public.add_sample_details(r.id);
  end loop;
end;
$$;
