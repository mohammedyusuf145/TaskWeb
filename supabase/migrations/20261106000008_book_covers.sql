-- ============================================================================
--  Mizan · 0008 · Book covers: choose an image or a typeset (text) cover, and its colour.
--  cover_url is kept when switching to text, so switching back restores the image.
-- ============================================================================

alter table public.books add column if not exists cover_mode text not null default 'text';
alter table public.books add column if not exists cover_color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_cover_mode_check') then
    alter table public.books add constraint books_cover_mode_check check (cover_mode in ('image', 'text'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_cover_color_check') then
    alter table public.books add constraint books_cover_color_check check (cover_color is null or cover_color ~ '^#[0-9a-f]{6}$');
  end if;
end;
$$;

-- Existing books that already have an image keep showing it.
update public.books set cover_mode = 'image' where cover_url is not null and cover_mode = 'text';
