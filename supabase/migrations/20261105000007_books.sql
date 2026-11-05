-- ============================================================================
--  Mizan · 0007 · Books: a personal reading log (shelf, ratings, notes, quotes).
--  Same conventions as every synced table: LWW trigger, soft delete, RLS, realtime.
-- ============================================================================

create table if not exists public.books (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 300),
  author            text not null default '' check (char_length(author) <= 200),
  /* An https URL (e.g. Open Library) or a small data:image/jpeg URL from the user's own photo. */
  cover_url         text check (cover_url is null or (char_length(cover_url) <= 150000 and (cover_url like 'https://%' or cover_url like 'data:image/jpeg;base64,%'))),
  isbn              text check (isbn is null or isbn ~ '^[0-9Xx-]{10,17}$'),
  status            text not null default 'want' check (status in ('want', 'reading', 'finished', 'dropped')),
  rating            smallint check (rating is null or rating between 1 and 5),
  pages             integer check (pages is null or pages between 1 and 20000),
  current_page      integer not null default 0 check (current_page >= 0),
  started_on        date,
  finished_on       date,
  language          text check (language is null or language in ('ar', 'en', 'other')),
  genre             text not null default '' check (char_length(genre) <= 80),
  tags              text[] not null default '{}' check (cardinality(tags) <= 20),
  notes             text not null default '' check (char_length(notes) <= 50000),
  quotes            jsonb not null default '[]' check (jsonb_typeof(quotes) = 'array' and pg_column_size(quotes) < 131072),
  favorite          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  check (finished_on is null or started_on is null or finished_on >= started_on)
);

create index if not exists books_pull_idx on public.books (user_id, server_updated_at);
create index if not exists books_status_idx on public.books (user_id, status) where deleted_at is null;

drop trigger if exists mizan_row_meta on public.books;
create trigger mizan_row_meta before insert or update on public.books for each row execute function public.mizan_row_meta();

alter table public.books enable row level security;
revoke all on public.books from anon;
grant select, insert, update, delete on public.books to authenticated;
drop policy if exists "own rows: select" on public.books;
drop policy if exists "own rows: insert" on public.books;
drop policy if exists "own rows: update" on public.books;
drop policy if exists "own rows: delete" on public.books;
create policy "own rows: select" on public.books for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.books for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.books for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.books for delete to authenticated using (user_id = (select auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'books') then
    alter publication supabase_realtime add table public.books;
  end if;
end;
$$;
