-- 007 · Only real notes
-- Run once in Supabase → SQL Editor, after 006. Safe to run again.
--
-- Every note now comes from what you actually say, type or draw:
--  • deletes the prototype's sample notes on "Morning routine" and the demo
--    editor pins ("Hold on the light") that 006 and the demo uploads added
--  • new accounts still get the sample versions, activity and chats, but no notes

-- 1. Remove the fake notes.
delete from public.notes where kind = 'pin';

delete from public.notes n
using public.versions v, public.projects p
where n.version_id = v.id
  and v.project_id = p.id
  and p.is_sample
  and n.body in (
    'Cut the intro to about 3 seconds.',
    'Slow down the coffee pour — hold 2 s longer.',
    'Use this kind of ending shot.',
    'Swap the outro music for something calmer?',
    'Cut the first 3 s, start on the coffee.',
    'Hold the hook text one beat longer.',
    'Brighter grade on the window shots.',
    'End on the croissant, not the laptop.'
  );

-- 2. Sample details for new accounts, without notes.
create or replace function public.add_sample_details(uid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  t0 timestamptz := now();
begin
  update public.profiles set sample_details_at = now()
  where id = uid and sample_details_at is null and samples_added_at is not null;
  if not found then
    return;
  end if;

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

  insert into public.activity (owner_id, project_id, by_key, title, body, tag, tag_tone, action, unread, created_at)
  select uid, (select id from public.projects where owner_id = uid and is_sample and name = a.proj limit 1),
    a.by_key, a.title, a.body, a.tag, a.tone, a.action, a.unread, t0 - a.ago
  from (values
    ('L', 'Morning routine',  'Leo uploaded v3',             'v3 is up. Tightened the intro and swapped the music.', 'NEW V3 · REVIEW', 'violet', 'review', true,  interval '2 hours'),
    ('L', 'Café opening',     'Leo asks for 1 more day',     'Could I have one more day for the colour pass?',        'REPLY BY ' || to_char(date_trunc('week', current_date)::date + 4, 'FMMM.FMDD'), 'yellow', 'ask', true, interval '3 hours'),
    ('S', null,               'Sara Kim',                    'Yes, I can do 2 days for $75.',                         null, null, 'thread', true,  interval '5 hours'),
    ('J', 'Product unboxing', 'Jon started editing',         'Started editing. First cut by Mon.',                    null, null, 'review', false, interval '1 day'),
    ('L', 'Wedding teaser',   'Leo sent 2 questions',        'Two quick questions about the vows part.',              null, null, 'review', false, interval '2 days'),
    ('M', 'Latte afternoon',  'You approved Latte afternoon','You approved it · $45 released to Leo',                 'DONE', 'grey', 'review', false, interval '24 days')
  ) as a(by_key, proj, title, body, tag, tone, action, unread, ago);

  insert into public.messages (owner_id, editor_key, from_me, body, created_at) values
    (uid, 'L', false, 'Hey Maya! Got the footage, starting tonight.', t0 - interval '3 days'),
    (uid, 'L', true,  'Amazing, thank you 🙏',                        t0 - interval '3 days' + interval '2 minutes'),
    (uid, 'L', false, 'Sent you my storefront link.',                  t0 - interval '3 days' + interval '5 minutes'),
    (uid, 'S', false, 'Yes, I can do 2 days for $75.',                 t0 - interval '5 hours'),
    (uid, 'J', false, 'You hired Jon · Product unboxing',              t0 - interval '1 day');
end;
$$;

revoke execute on function public.add_sample_details(uuid) from public, anon, authenticated;
