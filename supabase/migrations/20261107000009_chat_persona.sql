-- ============================================================================
--  Mizan · 0009 · Chat persona: each conversation is with the study tutor or the general assistant.
--  Fixed per thread, so the server's system prompt and tools never change mid-conversation.
-- ============================================================================

alter table public.chat_threads add column if not exists persona text not null default 'tutor';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_threads_persona_check') then
    alter table public.chat_threads add constraint chat_threads_persona_check check (persona in ('tutor', 'assistant'));
  end if;
end;
$$;
