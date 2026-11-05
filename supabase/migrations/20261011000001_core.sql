-- ============================================================================
--  Mizan · 0001 · Core schema
--  Every table: id, user_id, created_at, updated_at (client edit time, decides
--  last-write-wins), deleted_at (soft delete / tombstone) and server_updated_at
--  (server clock, used only as the incremental pull cursor).
-- ============================================================================

-- ── Row metadata + last-write-wins ──────────────────────────────────────────
create or replace function public.mizan_row_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.updated_at is null or new.updated_at > now() + interval '2 minutes' then
      new.updated_at := now();
    end if;
    if new.created_at is null or new.created_at > now() + interval '2 minutes' then
      new.created_at := now();
    end if;
  else
    -- Identity and ownership never change.
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    -- A write older than the stored row loses. Returning NULL skips the update,
    -- which also makes INSERT … ON CONFLICT DO UPDATE (upsert) a silent no-op.
    if new.updated_at < old.updated_at then
      return null;
    end if;
    -- A device clock far in the future is clamped so it cannot win forever.
    if new.updated_at > now() + interval '2 minutes' then
      new.updated_at := now();
    end if;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ── profiles & settings (one row per user, id = user_id) ────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name      text not null default '' check (char_length(display_name) <= 80),
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  constraint profiles_id_is_user check (id = user_id)
);

create table if not exists public.settings (
  id                       uuid primary key references auth.users (id) on delete cascade,
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language                 text not null default 'ar' check (language in ('ar', 'en')),
  theme                    text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  week_start               smallint not null default 0 check (week_start in (0, 1, 6)),
  calendar_primary         text not null default 'gregorian' check (calendar_primary in ('gregorian', 'hijri')),
  calendar_show_secondary  boolean not null default true,
  notifications            jsonb not null default '{"push": false, "in_app": true, "offsets_min": [1440, 60]}',
  timer_defaults           jsonb not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  server_updated_at        timestamptz not null default now(),
  constraint settings_id_is_user check (id = user_id),
  constraint settings_json_size check (pg_column_size(notifications) < 4096 and pg_column_size(timer_defaults) < 16384)
);

-- ── subjects ────────────────────────────────────────────────────────────────
create table if not exists public.subjects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 60),
  color             text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon              text not null default 'book-open' check (char_length(icon) <= 40),
  position          text not null collate "C",
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ── boards & columns ────────────────────────────────────────────────────────
create table if not exists public.boards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  position          text not null collate "C",
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.columns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id          uuid not null,
  name              text not null check (char_length(name) between 1 and 60),
  color             text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  kind              text check (kind is null or kind in ('todo', 'doing', 'done')),
  position          text not null collate "C",
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Composite keys make it impossible to attach a row to another user's parent.
  foreign key (board_id, user_id) references public.boards (id, user_id) on delete cascade
);

-- ── cards ───────────────────────────────────────────────────────────────────
create table if not exists public.cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id          uuid not null,
  column_id         uuid not null,
  subject_id        uuid,
  title             text not null check (char_length(title) between 1 and 300),
  description       text not null default '' check (char_length(description) <= 20000),
  notes             text not null default '' check (char_length(notes) <= 20000),
  due_at            timestamptz,
  due_has_time      boolean not null default false,
  priority          text not null default 'med' check (priority in ('low', 'med', 'high')),
  labels            text[] not null default '{}' check (cardinality(labels) <= 20),
  is_exam           boolean not null default false,
  estimate_min      integer check (estimate_min is null or estimate_min between 1 and 1440),
  repeat_rule       jsonb check (repeat_rule is null or pg_column_size(repeat_rule) < 2048),
  position          text not null collate "C",
  completed_at      timestamptz,
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (board_id, user_id)   references public.boards (id, user_id) on delete cascade,
  foreign key (column_id, user_id)  references public.columns (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table if not exists public.checklist_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id           uuid not null,
  text              text not null check (char_length(text) between 1 and 500),
  done              boolean not null default false,
  position          text not null collate "C",
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade
);

create table if not exists public.attachments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id           uuid not null,
  storage_path      text not null check (char_length(storage_path) <= 512),
  name              text not null check (char_length(name) between 1 and 255),
  mime              text not null check (char_length(mime) <= 120),
  size_bytes        integer not null check (size_bytes between 0 and 20971520),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  -- Files live under <user_id>/… so storage policies can scope them.
  constraint attachments_path_scoped check (split_part(storage_path, '/', 1) = user_id::text)
);

-- ── focus timer ─────────────────────────────────────────────────────────────
create table if not exists public.focus_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id        uuid,
  card_id           uuid,
  kind              text not null check (kind in ('focus', 'short_break', 'long_break', 'open')),
  started_at        timestamptz not null,
  ended_at          timestamptz not null,
  planned_sec       integer check (planned_sec is null or planned_sec between 1 and 86400),
  focused_sec       integer not null check (focused_sec between 0 and 86400),
  completed         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  check (ended_at >= started_at),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (card_id, user_id)    references public.cards (id, user_id) on delete set null (card_id)
);

-- One row per user: the running timer, so it can be resumed on another device.
create table if not exists public.timer_state (
  id                uuid primary key references auth.users (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  state             jsonb not null default '{}' check (pg_column_size(state) < 8192),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  constraint timer_state_id_is_user check (id = user_id)
);

-- ── tutor ───────────────────────────────────────────────────────────────────
create table if not exists public.chat_threads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id        uuid,
  title             text not null default '' check (char_length(title) <= 200),
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table if not exists public.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id         uuid not null,
  role              text not null check (role in ('user', 'assistant')),
  content           jsonb not null check (pg_column_size(content) < 262144),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (thread_id, user_id) references public.chat_threads (id, user_id) on delete cascade
);

create table if not exists public.flashcards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id        uuid,
  front             text not null check (char_length(front) between 1 and 2000),
  back              text not null check (char_length(back) between 1 and 4000),
  ease              real not null default 2.5 check (ease between 1.3 and 5),
  interval_days     real not null default 0 check (interval_days >= 0),
  repetitions       integer not null default 0 check (repetitions >= 0),
  lapses            integer not null default 0 check (lapses >= 0),
  due_at            timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

-- ── Triggers + indexes for every table ──────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'settings', 'subjects', 'boards', 'columns', 'cards', 'checklist_items',
    'attachments', 'focus_sessions', 'timer_state', 'chat_threads', 'chat_messages', 'flashcards'
  ] loop
    execute format('drop trigger if exists mizan_row_meta on public.%I', t);
    execute format(
      'create trigger mizan_row_meta before insert or update on public.%I
         for each row execute function public.mizan_row_meta()', t);
    execute format(
      'create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_pull_idx', t);
  end loop;
end;
$$;

create index if not exists columns_board_idx         on public.columns (board_id);
create index if not exists cards_board_idx           on public.cards (board_id);
create index if not exists cards_column_idx          on public.cards (column_id);
create index if not exists cards_subject_idx         on public.cards (subject_id);
create index if not exists cards_due_idx             on public.cards (user_id, due_at) where deleted_at is null;
create index if not exists checklist_card_idx        on public.checklist_items (card_id);
create index if not exists attachments_card_idx      on public.attachments (card_id);
create index if not exists focus_sessions_time_idx   on public.focus_sessions (user_id, started_at);
create index if not exists focus_sessions_card_idx   on public.focus_sessions (card_id);
create index if not exists focus_sessions_subj_idx   on public.focus_sessions (subject_id);
create index if not exists chat_threads_subject_idx  on public.chat_threads (subject_id);
create index if not exists chat_messages_thread_idx  on public.chat_messages (thread_id, created_at);
create index if not exists flashcards_due_idx        on public.flashcards (user_id, due_at) where deleted_at is null;
create index if not exists flashcards_subject_idx    on public.flashcards (subject_id);

-- ── New users get a profile and settings row ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id, display_name)
  values (new.id, new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 80), ''))
  on conflict (id) do nothing;

  insert into public.settings (id, user_id)
  values (new.id, new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
