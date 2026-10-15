-- ============================================================================
--  Mizan · 0002 · Row Level Security on EVERY table
--  A signed-in user can read and write only rows where user_id = their id.
--  Anonymous requests get nothing.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'settings', 'subjects', 'boards', 'columns', 'cards', 'checklist_items',
    'attachments', 'focus_sessions', 'timer_state', 'chat_threads', 'chat_messages', 'flashcards'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);

    -- (select auth.uid()) is evaluated once per statement, not per row.
    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Trigger functions are not meant to be called over the API.
revoke execute on function public.mizan_row_meta() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
