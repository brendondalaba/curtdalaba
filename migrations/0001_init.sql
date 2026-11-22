-- Curt Dalaba sermons (Cloudflare D1 / SQLite): members, sign-in sessions,
-- sermons, playback progress and the shared access code. Audio lives in R2.
-- Nothing here is reachable from the browser; every query runs in the Worker
-- after src/middleware.ts has checked the session.

create table users (
  id text primary key,
  email text not null unique collate nocase,
  full_name text,
  -- "pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>" (see src/lib/password.ts)
  password_hash text not null,
  is_admin integer not null default 0 check (is_admin in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- id is the SHA-256 of the cookie token, so a leaked table can't sign anyone in.
create table sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  expires_at integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index sessions_user_id_idx on sessions (user_id);

-- One-time links an admin hands to a member who forgot their password.
create table password_resets (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  expires_at integer not null
);

create index password_resets_user_id_idx on password_resets (user_id);

-- id is also the R2 object key suffix: sermons/<id>
create table sermons (
  id text primary key,
  title text not null check (length(title) between 1 and 200),
  scripture text check (scripture is null or length(scripture) <= 200),
  preached_on text not null,
  audio_content_type text not null,
  audio_size_bytes integer,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by text references users (id) on delete set null
);

create index sermons_preached_on_idx on sermons (preached_on desc, created_at desc);

create table playback_progress (
  user_id text not null references users (id) on delete cascade,
  sermon_id text not null references sermons (id) on delete cascade,
  position_seconds real not null default 0 check (position_seconds >= 0),
  completed integer not null default 0 check (completed in (0, 1)),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, sermon_id)
);

create index playback_progress_sermon_id_idx on playback_progress (sermon_id);

-- Single row: the code new members need to sign up.
create table app_settings (
  id integer primary key check (id = 1),
  access_code text not null check (length(access_code) between 6 and 64),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A random starting code; an admin changes it from the Admin page.
insert into app_settings (id, access_code) values (1, upper(hex(randomblob(4))));
