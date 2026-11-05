import { useLiveQuery } from 'dexie-react-hooks';
import { useDbStore } from '@/lib/db';
import { newId, softDelete, upsert } from '@/lib/db/repo';
import type { Book, BookQuote } from '@/types/database';
import { fromOpenLibrary, type FoundBook } from './logic';

export function useBooks(): Book[] | undefined {
  const db = useDbStore((s) => s.db);
  return useLiveQuery(async () => (db ? (await db.books.toArray()).filter((b) => !b.deleted_at) : []), [db]);
}

export function useBook(id: string | undefined): Book | null | undefined {
  const db = useDbStore((s) => s.db);
  const r = useLiveQuery(async () => ({ id, row: db && id ? ((await db.books.get(id)) ?? null) : null }), [db, id]);
  if (!r || r.id !== id) return undefined;
  return r.row && !r.row.deleted_at ? r.row : null;
}

export type NewBook = Partial<Book> & { title: string };

export function createBook(input: NewBook): Promise<Book> {
  return upsert('books', {
    id: newId(),
    author: '',
    cover_url: null,
    cover_mode: 'text',
    cover_color: null,
    isbn: null,
    status: 'want',
    rating: null,
    pages: null,
    current_page: 0,
    started_on: null,
    finished_on: null,
    language: null,
    genre: '',
    tags: [],
    notes: '',
    quotes: [],
    favorite: false,
    ...input,
  });
}

export const updateBook = (id: string, patch: Partial<Book>) => upsert('books', { id, ...patch });
export const deleteBook = (id: string) => softDelete('books', [id]);

export function addQuote(book: Book, text: string, page: number | null): Promise<Book> {
  const q: BookQuote = { id: newId(), text: text.trim().slice(0, 2000), page };
  return updateBook(book.id, { quotes: [q, ...book.quotes] });
}

export const removeQuote = (book: Book, quoteId: string) => updateBook(book.id, { quotes: book.quotes.filter((q) => q.id !== quoteId) });

/** Open Library search (public, no key). Network-only; the UI falls back to manual entry. */
export async function searchOpenLibrary(q: string, signal?: AbortSignal): Promise<FoundBook[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name,number_of_pages_median,cover_i,isbn,first_publish_year`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`open_library_${res.status}`);
  const body = (await res.json()) as { docs?: Record<string, unknown>[] };
  return (body.docs ?? []).map(fromOpenLibrary).filter((b): b is FoundBook => b !== null);
}

/** A photo of a cover, shrunk to a small JPEG data URL so it syncs with the row. */
export async function coverFromFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('unsupported');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 360 / bmp.width, 540 / bmp.height);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.8);
}
