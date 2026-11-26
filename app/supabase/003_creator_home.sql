-- 003 · Creator Home
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Adds what Home shows for each project (type, editor, round, due date,
-- whose turn it is, tags) and a one-time copy of the prototype's sample
-- projects, so a new account's Home looks like the prototype.
--
-- Editors: until a real editor accepts an invite, a project keeps a demo
-- editor by letter (L = Leo, J = Jon, F = Fay, K = Kai, S = Sara, D = Dani).

alter table public.projects
  add column if not exists type             text    not null default 'Vlog',
  add column if not exists editor_keys      text[]  not null default '{}',  -- first one is the main editor
  add column if not exists round            int     not null default 1,
  add column if not exists rounds           int     not null default 3,
  add column if not exists current_version  int     not null default 0,     -- v1, v2… (0 = no cut yet)
  add column if not exists turn             text    not null default 'them' check (turn in ('me', 'them')),
  add column if not exists new_version      boolean not null default false, -- "NEW V3"
  add column if not exists asks_extra_day   boolean not null default false, -- editor asks for +1 day
  add column if not exists unread_messages  int     not null default 0,     -- "2 NEW MESSAGES"
  add column if not exists due_date         date,
  add column if not exists price            int,
  add column if not exists duration_seconds int     not null default 0,
  add column if not exists done_kind        text    check (done_kind in ('done', 'posted', 'archived')),
  add column if not exists finished_at      date,
  add column if not exists notifications    boolean not null default true,
  add column if not exists is_sample        boolean not null default false;

alter table public.profiles
  add column if not exists samples_added_at timestamptz;

-- Members may edit these fields too (the owner still can't be changed).
grant update (type, editor_keys, round, rounds, current_version, turn, new_version,
  asks_extra_day, unread_messages, due_date, price, duration_seconds, done_kind,
  finished_at, notifications)
on public.projects to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Copy the prototype's sample projects into your account, once.
-- The app calls this the first time Home opens: supabase.rpc('add_sample_projects')
-- Due dates are this week (Mon … Sun), like the prototype.

create or replace function public.add_sample_projects()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  mon  date := date_trunc('week', current_date)::date;  -- this week's Monday
  t0   timestamptz := now();
  n    int;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  -- Only the first time.
  update public.profiles set samples_added_at = now()
  where id = uid and samples_added_at is null;
  if not found then
    return 0;
  end if;

  insert into public.projects (owner_id, is_sample, name, type, cover_image, editor_keys,
    status, round, rounds, current_version, turn, new_version, asks_extra_day,
    unread_messages, due_date, price, duration_seconds, done_kind, finished_at, created_at)
  select uid, true, s.name, s.type, 'sample:' || s.img, s.eds,
    s.status, s.round, 3, s.v, s.turn, s.newv, s.asks,
    s.unread, mon + s.due_in, s.price, s.dur, s.kind, s.fin,
    t0 - make_interval(secs => s.ord)   -- keeps the prototype's order (newest first)
  from (values
    -- ord, name, type, img, editors, status, round, v, turn, newV, asks, unread, due (days after Mon), price, dur, done kind, finished
    ( 1, 'Morning routine',      'Vlog',         'mr',   '{L}'::text[],     'in_progress', 2, 3, 'me',   true,  false, 0, 5,    75,  84,  null,       null::date),
    ( 2, 'Café opening',         'Food',         'cafe', '{L}',             'in_progress', 1, 1, 'me',   false, true,  0, 4,    120, 112, null,       null),
    ( 3, 'Product unboxing',     'Product',      'pu',   '{J,F,K}',         'in_progress', 2, 2, 'them', false, false, 0, 0,    90,  67,  null,       null),
    ( 4, 'Wedding teaser',       'Vlog',         'wed',  '{L}',             'in_progress', 1, 0, 'them', false, false, 0, 4,    150, 138, null,       null),
    ( 5, 'Gym promo',            'Product',      'gym',  '{J}',             'in_progress', 3, 3, 'them', false, false, 0, 4,    60,  49,  null,       null),
    ( 6, 'Sunday reset',         'Vlog',         's08',  '{L}',             'in_progress', 1, 0, 'me',   false, false, 2, 0,    60,  76,  null,       null),
    ( 7, 'Monthly favorites',    'Product',      's24',  '{J}',             'in_progress', 2, 1, 'them', false, false, 0, 1,    75,  103, null,       null),
    ( 8, 'Latte afternoon',      'Vlog',         'c1',   '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 95,  'posted',   date '2026-10-30'),
    ( 9, 'Market day',           'Vlog',         'c2',   '{L}',             'done',        3, 2, 'them', false, false, 0, null, null, 71,  'posted',   date '2026-10-21'),
    (10, 'Picnic with Mochi',    'Vlog',         'c3',   '{J}',             'done',        3, 3, 'them', false, false, 0, null, null, 126, 'done',     date '2026-10-12'),
    (11, 'Rainy night walk',     'Travel',       'c4',   '{L}',             'done',        3, 2, 'them', false, false, 0, null, null, 58,  'posted',   date '2026-10-02'),
    (12, 'Waking up slow',       'Vlog',         's01',  '{S}',             'done',        3, 2, 'them', false, false, 0, null, null, 62,  'posted',   date '2026-10-28'),
    (13, 'Skincare routine',     'Talking head', 's02',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 88,  'done',     date '2026-10-24'),
    (14, 'Journal with me',      'Vlog',         's04',  '{J}',             'done',        3, 2, 'them', false, false, 0, null, null, 145, 'posted',   date '2026-10-19'),
    (15, 'Window seat',          'Vlog',         's07',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 97,  'posted',   date '2026-10-15'),
    (16, 'Couch day with Mochi', 'Vlog',         's10',  '{J}',             'done',        3, 2, 'them', false, false, 0, null, null, 54,  'done',     date '2026-10-09'),
    (17, 'Unboxing day',         'Product',      's11',  '{S}',             'done',        3, 3, 'them', false, false, 0, null, null, 118, 'posted',   date '2026-10-04'),
    (18, 'Desk setup tour',      'Product',      's13',  '{L}',             'done',        3, 2, 'them', false, false, 0, null, null, 83,  'posted',   date '2026-09-30'),
    (19, 'Garden wedding',       'Vlog',         's14',  '{J}',             'done',        3, 3, 'them', false, false, 0, null, null, 171, 'done',     date '2026-09-26'),
    (20, 'Dance floor',          'Vlog',         's16',  '{L}',             'done',        3, 2, 'them', false, false, 0, null, null, 69,  'posted',   date '2026-09-22'),
    (21, 'Gym check-in',         'Vlog',         's17',  '{J}',             'done',        3, 3, 'them', false, false, 0, null, null, 92,  'posted',   date '2026-09-18'),
    (22, 'Pilates class',        'Vlog',         's19',  '{S}',             'done',        3, 2, 'them', false, false, 0, null, null, 108, 'done',     date '2026-09-14'),
    (23, 'Morning run',          'Vlog',         's20',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 47,  'posted',   date '2026-09-10'),
    (24, 'Grocery run',          'Food',         's21',  '{J}',             'done',        3, 2, 'them', false, false, 0, null, null, 131, 'posted',   date '2026-09-06'),
    (25, 'Serum review',         'Talking head', 's25',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 79,  'done',     date '2026-09-02'),
    (26, 'Lipstick try-on',      'Talking head', 's26',  '{J}',             'done',        3, 2, 'them', false, false, 0, null, null, 64,  'posted',   date '2026-08-29'),
    (27, 'Pasta night',          'Food',         's27',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 114, 'posted',   date '2026-09-20'),
    (28, 'Night reading',        'Vlog',         's28',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 73,  'posted',   date '2026-09-14'),
    (29, 'Golden hour',          'Travel',       's30',  '{L}',             'done',        3, 3, 'them', false, false, 0, null, null, 156, 'posted',   date '2026-09-08')
  ) as s(ord, name, type, img, eds, status, round, v, turn, newv, asks, unread, due_in, price, dur, kind, fin);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.add_sample_projects() from public, anon;
grant execute on function public.add_sample_projects() to authenticated;
