-- Curt Dalaba sermons: members, sermons, playback progress and the shared access code.
-- Every table has row level security on. Audio files live in Cloudflare R2, not here.

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Members read their own profile; admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins update profiles"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Accounts can only be created by the site's sign-up endpoint, which checks the
-- access code and then creates the user with app_metadata.access_granted = true.
-- app_metadata can't be set from the public sign-up API, so a direct call to
-- Supabase Auth with the publishable key is rejected here even if public
-- sign-ups are left enabled in the dashboard.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'access_granted', '') <> 'true' then
    raise exception 'Sign-ups require an access code';
  end if;

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Sermons. id is also the R2 object key suffix: sermons/<id>
-- ---------------------------------------------------------------------------
create table public.sermons (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 200),
  scripture text check (char_length(scripture) <= 200),
  preached_on date not null,
  audio_content_type text not null,
  audio_size_bytes bigint,
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index sermons_preached_on_idx on public.sermons (preached_on desc);
create index sermons_created_by_idx on public.sermons (created_by);

alter table public.sermons enable row level security;

create policy "Members read sermons"
  on public.sermons for select to authenticated
  using (true);

create policy "Admins add sermons"
  on public.sermons for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit sermons"
  on public.sermons for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete sermons"
  on public.sermons for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Where each member stopped in each sermon
-- ---------------------------------------------------------------------------
create table public.playback_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null references public.sermons (id) on delete cascade,
  position_seconds real not null default 0 check (position_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, sermon_id)
);

create index playback_progress_sermon_id_idx on public.playback_progress (sermon_id);

alter table public.playback_progress enable row level security;

create policy "Members read their own progress"
  on public.playback_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members add their own progress"
  on public.playback_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Members update their own progress"
  on public.playback_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Single-row settings: the access code new members need to sign up
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  access_code text not null check (char_length(access_code) between 6 and 64),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Admins read settings"
  on public.app_settings for select to authenticated
  using ((select public.is_admin()));

create policy "Admins update settings"
  on public.app_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- A random starting code; an admin changes it from the Admin page.
insert into public.app_settings (access_code)
values (upper(substr(md5(random()::text), 1, 8)));

-- Nothing here is for signed-out visitors.
revoke all on table public.profiles, public.sermons, public.playback_progress, public.app_settings from anon;
