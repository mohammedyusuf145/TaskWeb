-- ============================================================================
--  Mizan · 0005 · Reminders and web push
--  - cards.reminder_offsets: per-card override (NULL = user defaults, {} = off)
--  - settings.timezone: needed to place date-only reminders at 08:00 local
--  - push_subscriptions: one row per browser/device that accepted push
--  - reminder_log: what has been sent, so nothing is sent twice
--  - due_reminders(): the reminders due in a window (service role only)
-- ============================================================================

alter table public.cards
  add column if not exists reminder_offsets integer[]
  check (
    reminder_offsets is null
    or (cardinality(reminder_offsets) <= 8 and 0 <= all (reminder_offsets) and 40320 >= all (reminder_offsets))
  );

alter table public.settings
  add column if not exists timezone text not null default 'Asia/Bahrain'
  check (char_length(timezone) between 1 and 64);

-- ── Push subscriptions (written directly by the client, never synced to IndexedDB) ──
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1024),
  p256dh      text not null check (char_length(p256dh) <= 256),
  auth        text not null check (char_length(auth) <= 64),
  user_agent  text not null default '' check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Sent log (server only: RLS on, no policies) ─────────────────────────────
create table if not exists public.reminder_log (
  card_id    uuid not null references public.cards (id) on delete cascade,
  offset_min integer not null,
  due_at     timestamptz not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  sent_at    timestamptz not null default now(),
  primary key (card_id, offset_min, due_at)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

create index if not exists cards_open_due_idx on public.cards (due_at)
  where deleted_at is null and completed_at is null and due_at is not null;

-- ── Which reminders fall in (p_from, p_to]? Mirrors src/features/reminders/compute.ts ──
create or replace function public.due_reminders(p_from timestamptz, p_to timestamptz)
returns table (
  user_id      uuid,
  card_id      uuid,
  board_id     uuid,
  title        text,
  is_exam      boolean,
  due_at       timestamptz,
  due_has_time boolean,
  offset_min   integer,
  fire_at      timestamptz,
  subject_name text,
  language     text,
  timezone     text
)
language sql
stable
security definer
set search_path = ''
as $$
  with prefs as (
    select s.user_id, s.language, s.timezone, s.notifications
    from public.settings s
    where coalesce((s.notifications ->> 'push')::boolean, false)
  ),
  candidates as (
    select c.*, p.language, p.timezone, p.notifications
    from public.cards c
    join prefs p on p.user_id = c.user_id
    join public.boards b on b.id = c.board_id and b.deleted_at is null and b.archived_at is null
    where c.deleted_at is null
      and c.completed_at is null
      and c.due_at is not null
      -- Reminders are at most 4 weeks before the due date.
      and c.due_at > p_from
      and c.due_at <= p_to + interval '29 days'
  ),
  expanded as (
    select distinct
      c.id as card_id,
      case
        when c.due_has_time then x
        when x < 1440 then 0
        else (round(x / 1440.0) * 1440)::integer
      end as offset_min
    from candidates c
    cross join lateral unnest(
      coalesce(
        c.reminder_offsets,
        array(select jsonb_array_elements_text(coalesce(c.notifications -> 'offsets_min', '[1440, 60]'::jsonb))::integer)
      )
    ) as x
    where x between 0 and 40320
  )
  select
    c.user_id, c.id, c.board_id, c.title, c.is_exam, c.due_at, c.due_has_time, e.offset_min, f.fire_at,
    sub.name, c.language, c.timezone
  from expanded e
  join candidates c on c.id = e.card_id
  cross join lateral (
    select case
      when c.due_has_time then c.due_at - make_interval(mins => e.offset_min)
      else (
        date_trunc('day', c.due_at at time zone c.timezone)
        - make_interval(days => e.offset_min / 1440)
        + interval '8 hours'
      ) at time zone c.timezone
    end as fire_at
  ) f
  left join public.subjects sub on sub.id = c.subject_id and sub.deleted_at is null
  where f.fire_at > p_from
    and f.fire_at <= p_to
    and not exists (
      select 1 from public.reminder_log l
      where l.card_id = c.id and l.offset_min = e.offset_min and l.due_at = c.due_at
    )
  order by f.fire_at;
$$;

revoke execute on function public.due_reminders(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz, timestamptz) to service_role;
