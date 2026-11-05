import { describe, expect, it } from 'vitest';
import type { Book } from '@/types/database';
import { coverTone, fromOpenLibrary, progress, sortBooks, statusPatch, yearStats } from './logic';

const book = (p: Partial<Book>): Book =>
  ({
    id: Math.random().toString(36), user_id: 'u', title: 'T', author: '', cover_url: null, isbn: null, status: 'want', rating: null, pages: null,
    current_page: 0, started_on: null, finished_on: null, language: null, genre: '', tags: [], notes: '', quotes: [], favorite: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null, ...p,
  }) as Book;

describe('books: status transitions', () => {
  it('starting sets the start date once', () => {
    expect(statusPatch(book({}), 'reading', '2026-11-05')).toMatchObject({ status: 'reading', started_on: '2026-11-05', finished_on: null });
    expect(statusPatch(book({ started_on: '2026-10-01' }), 'reading', '2026-11-05').started_on).toBe('2026-10-01');
  });
  it('finishing sets the finish date, keeps a valid start, fills progress', () => {
    const p = statusPatch(book({ status: 'reading', started_on: '2026-10-01', pages: 320, current_page: 140 }), 'finished', '2026-11-05');
    expect(p).toMatchObject({ finished_on: '2026-11-05', started_on: '2026-10-01', current_page: 320 });
    // A start date after the finish date would break the database check: it is pulled back.
    expect(statusPatch(book({ started_on: '2026-12-01' }), 'finished', '2026-11-05').started_on).toBe('2026-11-05');
  });
  it('back to want-to-read clears dates and progress', () => {
    expect(statusPatch(book({ started_on: '2026-10-01', current_page: 40 }), 'want')).toMatchObject({ started_on: null, finished_on: null, current_page: 0 });
  });
});

describe('books: progress and stats', () => {
  it('progress is clamped and complete when finished', () => {
    expect(progress(book({ pages: 200, current_page: 50, status: 'reading' }))).toBe(0.25);
    expect(progress(book({ pages: 200, current_page: 900, status: 'reading' }))).toBe(1);
    expect(progress(book({ pages: null, status: 'reading' }))).toBeNull();
    expect(progress(book({ pages: null, status: 'finished' }))).toBe(1);
  });
  it('year stats count only books finished that year', () => {
    const s = yearStats(
      [
        book({ status: 'finished', finished_on: '2026-02-10', pages: 200, rating: 4 }),
        book({ status: 'finished', finished_on: '2026-02-20', pages: 100, rating: 5 }),
        book({ status: 'finished', finished_on: '2025-12-31', pages: 999, rating: 1 }),
        book({ status: 'finished', finished_on: '2026-07-01', pages: null }),
        book({ status: 'reading' }),
        book({ status: 'reading', deleted_at: '2026-03-01T00:00:00Z' }),
      ],
      2026,
    );
    expect(s).toMatchObject({ finished: 3, pages: 300, averageRating: 4.5, reading: 1 });
    expect(s.byMonth[1]).toBe(2);
    expect(s.byMonth[6]).toBe(1);
  });
  it('sorts by rating then recency, and titles in the user locale', () => {
    const a = book({ title: 'ب', rating: 3, updated_at: '2026-01-02T00:00:00Z' });
    const b = book({ title: 'أ', rating: 5 });
    expect(sortBooks([a, b], 'rating', 'ar').map((x) => x.title)).toEqual(['أ', 'ب']);
    expect(sortBooks([a, b], 'title', 'ar').map((x) => x.title)).toEqual(['أ', 'ب']);
  });
});

describe('books: Open Library mapping', () => {
  it('keeps safe fields only and builds an https cover URL', () => {
    expect(
      fromOpenLibrary({ title: ' The Days ', author_name: ['Taha Hussein'], number_of_pages_median: 312, cover_i: 12345, isbn: ['bad', '9789777341234'], first_publish_year: 1929 }),
    ).toEqual({ title: 'The Days', author: 'Taha Hussein', pages: 312, isbn: '9789777341234', cover_url: 'https://covers.openlibrary.org/b/id/12345-M.jpg', year: 1929 });
    expect(fromOpenLibrary({ title: '' })).toBeNull();
    expect(fromOpenLibrary({ title: 'X', cover_i: 'javascript:1', number_of_pages_median: -3 })).toMatchObject({ cover_url: null, pages: null });
  });
  it('cover tone is stable per title', () => {
    expect(coverTone('الأيام')).toBe(coverTone('الأيام'));
  });
});
