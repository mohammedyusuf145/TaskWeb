-- ============================================================================
--  Mizan · 0006 · AI tutor
--  - study_topics: per-subject topic accuracy (synced, RLS) for weak-topic tracking
--  - ai_usage: per-user daily usage + a one-minute request window (server only)
--  - tutor_files: Anthropic Files API uploads, so a user can only reference their own
--  - ai_reserve()/ai_record(): atomic rate limiting and usage accounting (service role only)
-- ============================================================================

create table if not exists public.study_topics (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id        uuid,
  topic             text not null check (char_length(topic) between 1 and 120),
  attempts          integer not null default 0 check (attempts >= 0),
  correct           integer not null default 0 check (correct >= 0 and correct <= attempts),
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create index if not exists study_topics_subject_idx on public.study_topics (subject_id);
drop trigger if exists mizan_row_meta on public.study_topics;
create trigger mizan_row_meta before insert or update on public.study_topics for each row execute function public.mizan_row_meta();
create index if not exists study_topics_pull_idx on public.study_topics (user_id, server_updated_at);

alter table public.study_topics enable row level security;
revoke all on public.study_topics from anon;
grant select, insert, update, delete on public.study_topics to authenticated;
drop policy if exists "own rows: select" on public.study_topics;
drop policy if exists "own rows: insert" on public.study_topics;
drop policy if exists "own rows: update" on public.study_topics;
drop policy if exists "own rows: delete" on public.study_topics;
create policy "own rows: select" on public.study_topics for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.study_topics for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.study_topics for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.study_topics for delete to authenticated using (user_id = (select auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_topics') then
    alter publication supabase_realtime add table public.study_topics;
  end if;
end;
$$;

-- ── Usage (server only: RLS on, no policies) ────────────────────────────────
create table if not exists public.ai_usage (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  messages     integer not null default 0,
  tokens       bigint  not null default 0,
  minute_start timestamptz,
  minute_count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create table if not exists public.tutor_files (
  file_id    text primary key check (file_id ~ '^file_[A-Za-z0-9_-]{4,120}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  mime       text not null,
  created_at timestamptz not null default now()
);
create index if not exists tutor_files_user_idx on public.tutor_files (user_id);
alter table public.tutor_files enable row level security;
revoke all on public.tutor_files from anon, authenticated;

/**
 * Atomically checks and counts one tutor request.
 * Returns {ok:true, messages_left, tokens_left} or {ok:false, reason, retry_after?}.
 * reason: 'daily_messages' | 'daily_tokens' | 'rate_limited'
 */
create or replace function public.ai_reserve(
  p_user uuid,
  p_is_message boolean,
  p_per_minute integer,
  p_daily_messages integer,
  p_daily_tokens bigint,
  p_tz text default 'Asia/Bahrain'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'Asia/Bahrain' end;
  d date := (now() at time zone tz)::date;
  r public.ai_usage;
begin
  insert into public.ai_usage (user_id, day) values (p_user, d) on conflict do nothing;
  select * into r from public.ai_usage where user_id = p_user and day = d for update;

  if r.tokens >= p_daily_tokens then
    return jsonb_build_object('ok', false, 'reason', 'daily_tokens');
  end if;
  if p_is_message and r.messages >= p_daily_messages then
    return jsonb_build_object('ok', false, 'reason', 'daily_messages');
  end if;

  if r.minute_start is null or now() - r.minute_start >= interval '1 minute' then
    r.minute_start := now();
    r.minute_count := 0;
  end if;
  if r.minute_count >= p_per_minute then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'retry_after', greatest(1, ceil(extract(epoch from (r.minute_start + interval '1 minute' - now())))::integer));
  end if;

  update public.ai_usage
     set minute_start = r.minute_start,
         minute_count = r.minute_count + 1,
         messages = messages + case when p_is_message then 1 else 0 end
   where user_id = p_user and day = d
  returning * into r;

  return jsonb_build_object('ok', true,
    'messages_left', greatest(0, p_daily_messages - r.messages),
    'tokens_left', greatest(0, p_daily_tokens - r.tokens));
end;
$$;

create or replace function public.ai_record(p_user uuid, p_tokens bigint, p_tz text default 'Asia/Bahrain')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage (user_id, day, tokens)
  values (
    p_user,
    (now() at time zone (case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'Asia/Bahrain' end))::date,
    greatest(0, p_tokens)
  )
  on conflict (user_id, day) do update set tokens = public.ai_usage.tokens + excluded.tokens;
$$;

revoke execute on function public.ai_reserve(uuid, boolean, integer, integer, bigint, text) from public, anon, authenticated;
revoke execute on function public.ai_record(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, boolean, integer, integer, bigint, text) to service_role;
grant execute on function public.ai_record(uuid, bigint, text) to service_role;
