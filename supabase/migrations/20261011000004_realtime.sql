-- ============================================================================
--  Mizan · 0004 · Realtime: broadcast row changes so other devices update live.
--  Realtime respects RLS, so each user only receives their own rows.
-- ============================================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'profiles', 'settings', 'subjects', 'boards', 'columns', 'cards', 'checklist_items',
    'attachments', 'focus_sessions', 'timer_state', 'chat_threads', 'chat_messages', 'flashcards'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
