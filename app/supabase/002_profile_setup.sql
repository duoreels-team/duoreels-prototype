-- Duoreels database update 002: profile setup after email-code sign-in.
-- Run once in Supabase → SQL Editor, after schema.sql.
--  • profiles.avatar_url — the profile photo
--  • profiles.onboarded_at — empty until "Set up your profile" is finished
--  • a public "avatars" bucket; each person can only upload into their own folder

begin;

alter table public.profiles
  add column avatar_url text,
  add column onboarded_at timestamptz;

-- Anyone who already signed up with name + role has finished setup.
update public.profiles set onboarded_at = created_at where onboarded_at is null;

-- New users who sign in with an email code have no name/role yet → they see "Set up your profile".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  v_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, name, role, onboarded_at)
  values (
    new.id,
    coalesce(v_name, ''),
    case when v_role = 'editor' then 'editor' else 'creator' end,
    case when v_name is not null and v_role in ('creator', 'editor') then now() end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Files go in "<your user id>/<file name>".
create policy "See own avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
