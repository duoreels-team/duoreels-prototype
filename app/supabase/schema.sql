-- Duoreels database setup
-- Paste this whole file into Supabase → SQL Editor and click Run (once).
-- It creates the tables, turns on row level security (RLS) so people only
-- see projects they are in, and makes a private storage bucket for files.

begin;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

-- One row per user. Filled in automatically when someone signs up.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  role        text not null default 'creator' check (role in ('creator', 'editor')),
  created_at  timestamptz not null default now()
);

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Project 1',
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status       text not null default 'in_progress' check (status in ('in_progress', 'done')),
  brief        text,
  tags         text[] not null default '{}',
  cover_image  text, -- path in the "project-files" bucket, or a web link
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Who is in which project. The owner is added automatically;
-- others join by accepting an invite.
create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  email        text not null check (position('@' in email) > 1),
  invited_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
create unique index invites_project_email_key on public.invites (project_id, lower(email));

-- v1, v2, v3… If you leave "number" empty it picks the next one.
create table public.versions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  number       int not null check (number > 0),
  video_path   text not null, -- path in the "project-files" bucket
  uploaded_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (project_id, number)
);

-- A comment on a version, at a time in the video (in seconds).
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.versions (id) on delete cascade,
  author_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  time_seconds  numeric(10, 3) not null default 0 check (time_seconds >= 0),
  body          text not null,
  created_at    timestamptz not null default now()
);

-- Raw footage: either an uploaded file or a link (e.g. Google Drive).
create table public.footage (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  added_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  title       text,
  file_path   text, -- path in the "project-files" bucket
  link_url    text,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(file_path, link_url) = 1)
);

create index on public.projects (owner_id);
create index on public.project_members (user_id);
create index on public.invites (lower(email));
create index on public.versions (project_id);
create index on public.notes (version_id);
create index on public.footage (project_id);

-- ─────────────────────────────────────────────────────────────
-- Helper functions (used by the security rules below)
-- ─────────────────────────────────────────────────────────────

create function public.is_project_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_project_owner(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = (select auth.uid())
  );
$$;

-- True if the signed-in user shares at least one project with this person.
create function public.shares_project_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- Turns text into a uuid, or null if it isn't one (for storage folder names).
create function public.try_uuid(p_text text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Automatic behaviour
-- ─────────────────────────────────────────────────────────────

-- Make a profile when someone signs up (name and role come from the sign-up form).
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'editor' then 'editor' else 'creator' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The person who creates a project is its first member.
create function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.add_owner_as_member();

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_project_updated
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- Number new versions v1, v2, v3… automatically.
create function public.set_version_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.number is null then
    select coalesce(max(v.number), 0) + 1 into new.number
    from public.versions v where v.project_id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger on_version_created
  before insert on public.versions
  for each row execute function public.set_version_number();

-- Accept an invite sent to your email: joins you to the project.
-- Call from the app with: supabase.rpc('accept_invite', { invite_id })
create function public.accept_invite(invite_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;

  select * into v_invite
  from public.invites i
  where i.id = invite_id
    and i.status = 'pending'
    and lower(i.email) = lower(auth.jwt() ->> 'email')
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  insert into public.project_members (project_id, user_id)
  values (v_invite.project_id, auth.uid())
  on conflict do nothing;

  update public.invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return v_invite.project_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Who can use what
-- Signed-out visitors (anon) get nothing. Signed-in users go through RLS.
-- ─────────────────────────────────────────────────────────────

revoke all on public.profiles, public.projects, public.project_members,
  public.invites, public.versions, public.notes, public.footage from anon;

grant select, insert, update, delete on public.profiles, public.projects,
  public.project_members, public.invites, public.versions, public.notes,
  public.footage to authenticated;

-- Project members can edit these project fields, but not change the owner.
revoke update on public.projects from authenticated;
grant update (name, status, brief, tags, cover_image) on public.projects to authenticated;

-- Invites are accepted through accept_invite(), not edited directly.
revoke update on public.invites from authenticated;

revoke execute on function
  public.is_project_member(uuid), public.is_project_owner(uuid),
  public.shares_project_with(uuid), public.try_uuid(text),
  public.handle_new_user(), public.add_owner_as_member(),
  public.touch_updated_at(), public.set_version_number(),
  public.accept_invite(uuid)
from public, anon, authenticated;

grant execute on function
  public.is_project_member(uuid), public.is_project_owner(uuid),
  public.shares_project_with(uuid), public.try_uuid(text),
  public.accept_invite(uuid)
to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.invites         enable row level security;
alter table public.versions        enable row level security;
alter table public.notes           enable row level security;
alter table public.footage         enable row level security;

-- profiles: see yourself and people you share a project with; edit only yourself.
create policy "See own and teammates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_project_with(id));

create policy "Edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects: only members see them.
create policy "Members see their projects" on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_project_member(id));

create policy "Create your own projects" on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Members edit their projects" on public.projects
  for update to authenticated
  using (public.is_project_member(id))
  with check (public.is_project_member(id));

create policy "Owners delete their projects" on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- project_members
create policy "Members see who is in the project" on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "Owners add members" on public.project_members
  for insert to authenticated
  with check (public.is_project_owner(project_id));

create policy "Owners remove members, anyone can leave" on public.project_members
  for delete to authenticated
  using (public.is_project_owner(project_id) or user_id = (select auth.uid()));

-- invites: project members, and the person invited, can see them.
create policy "See invites for your projects or your email" on public.invites
  for select to authenticated
  using (
    public.is_project_member(project_id)
    or lower(email) = lower((select auth.jwt()) ->> 'email')
  );

create policy "Members invite people" on public.invites
  for insert to authenticated
  with check (
    public.is_project_member(project_id)
    and invited_by = (select auth.uid())
    and status = 'pending'
  );

create policy "Inviter or owner cancels invites" on public.invites
  for delete to authenticated
  using (invited_by = (select auth.uid()) or public.is_project_owner(project_id));

-- versions
create policy "Members see versions" on public.versions
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "Members upload versions" on public.versions
  for insert to authenticated
  with check (public.is_project_member(project_id) and uploaded_by = (select auth.uid()));

create policy "Uploader deletes a version" on public.versions
  for delete to authenticated
  using (uploaded_by = (select auth.uid()));

-- notes
create policy "Members see notes" on public.notes
  for select to authenticated
  using (public.is_project_member((select v.project_id from public.versions v where v.id = version_id)));

create policy "Members add notes" on public.notes
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_project_member((select v.project_id from public.versions v where v.id = version_id))
  );

create policy "Authors edit their notes" on public.notes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors delete their notes" on public.notes
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- footage
create policy "Members see footage" on public.footage
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "Members add footage" on public.footage
  for insert to authenticated
  with check (public.is_project_member(project_id) and added_by = (select auth.uid()));

create policy "Adder deletes footage" on public.footage
  for delete to authenticated
  using (added_by = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- File storage: one private bucket. Put each file under its project's id,
-- e.g. "<project id>/v1.mp4" or "<project id>/cover.jpg".
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy "Members read project files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and public.is_project_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "Members upload project files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.is_project_member(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "Uploader deletes own project files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-files' and owner_id = (select auth.uid())::text);

commit;
