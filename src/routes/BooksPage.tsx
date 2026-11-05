import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import * as m from 'motion/react-m';
import { BookOpen, Heart, Plus } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n';
import { Button, EmptyState, Segmented, Select, Skeleton } from '@/components/ui';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';
import type { Book, BookStatus } from '@/types/database';
import { useBook, useBooks } from '@/features/books/data';
import { progress, sortBooks, yearStats, type BookSort } from '@/features/books/logic';
import { BookCover } from '@/features/books/BookCover';
import { Stars } from '@/features/books/Stars';
import { BookSheet } from '@/features/books/BookSheet';
import { AddBookDialog } from '@/features/books/AddBookDialog';

type Filter = 'all' | BookStatus;
const FILTER_KEY = 'mizan.books.filter';
const SORT_KEY = 'mizan.books.sort';
const read = <T extends string>(k: string, d: T): T => {
  try {
    return (localStorage.getItem(k) as T) || d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function BooksPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const { bookId } = useParams();
  const books = useBooks();
  const open = useBook(bookId);
  const [adding, setAdding] = useState(false);
  const [filter, setFilterState] = useState<Filter>(() => read(FILTER_KEY, 'all'));
  const [sort, setSortState] = useState<BookSort>(() => read(SORT_KEY, 'recent'));
  const year = new Date().getFullYear();

  const stats = useMemo(() => yearStats(books ?? [], year), [books, year]);
  const reading = useMemo(() => sortBooks((books ?? []).filter((b) => b.status === 'reading'), 'recent', lang), [books, lang]);
  const shown = useMemo(() => sortBooks((books ?? []).filter((b) => filter === 'all' || b.status === filter), sort, intlLocale(lang)), [books, filter, sort, lang]);
  const openBook = (b: Book) => navigate(`/books/${b.id}`);
  const nf = new Intl.NumberFormat(intlLocale(lang));

  return (
    <>
      <PageHeader
        title={t('nav.books')}
        actions={
          <Button variant="primary" size="sm" iconStart={<Plus size={15} />} onClick={() => setAdding(true)}>
            <span className="max-sm:sr-only">{t('books.add')}</span>
          </Button>
        }
      />
      <PageBody>
        {!books ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="aspect-[2/3]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={20} />}
            title={t('books.empty.title')}
            body={t('books.empty.body')}
            action={
              <Button variant="primary" iconStart={<Plus size={16} />} onClick={() => setAdding(true)}>
                {t('books.add')}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-10">
            {/* The year at a glance: one ruled strip, not four identical cards. */}
            <section aria-label={t('books.stat.finished', { year })} className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-border bg-surface-1 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
              <Stat label={t('books.stat.finished', { year })} value={nf.format(stats.finished)} />
              <Stat label={t('books.stat.pages')} value={nf.format(stats.pages)} />
              <Stat label={t('books.stat.rating')} value={stats.averageRating ? nf.format(stats.averageRating) : t('books.stat.none')} />
              <Stat label={t('books.stat.reading')} value={nf.format(stats.reading)} />
              <MonthBars counts={stats.byMonth} year={year} />
            </section>

            {reading.length > 0 && (
              <section aria-labelledby="reading-now">
                <h2 id="reading-now" className="mb-4 text-lg text-text">
                  {t('books.readingNow')}
                </h2>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {reading.map((b) => {
                    const p = progress(b);
                    return (
                      <li key={b.id}>
                        <button type="button" onClick={() => openBook(b)} className="lift press flex w-full gap-4 rounded-[12px] border border-border bg-surface-1 p-3 text-start">
                          <span className="w-14 shrink-0">
                            <BookCover title={b.title} author={b.author} url={b.cover_url} mode={b.cover_mode} color={b.cover_color} size="sm" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                            <span className="truncate font-reading text-[15px] font-semibold text-text" dir="auto">
                              {b.title}
                            </span>
                            <span className="truncate text-sm text-text-3" dir="auto">
                              {b.author}
                            </span>
                            {p !== null && (
                              <>
                                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                                  <span className="block h-full rounded-full bg-accent" style={{ width: `${p * 100}%` }} />
                                </span>
                                <span className="text-xs text-text-3 tabular">{t('books.pageOf', { n: nf.format(b.current_page), total: nf.format(b.pages!) })}</span>
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-labelledby="shelf">
              <h2 id="shelf" className="sr-only">
                {t('nav.books')}
              </h2>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="max-w-full overflow-x-auto">
                  <Segmented
                    label={t('books.filter')}
                    value={filter}
                    onValueChange={(v) => {
                      setFilterState(v);
                      write(FILTER_KEY, v);
                    }}
                    className="[&>*]:px-2.5 [&>*]:text-sm"
                    options={(['all', 'reading', 'want', 'finished', 'dropped'] as const).map((f) => ({ value: f, label: f === 'all' ? t('books.all') : t(`books.status.${f}`) }))}
                  />
                </div>
                <span className="flex-1" />
                <div className="w-44">
                  <Select
                    aria-label={t('books.sort')}
                    value={sort}
                    onChange={(e) => {
                      setSortState(e.target.value as BookSort);
                      write(SORT_KEY, e.target.value);
                    }}
                  >
                    {(['recent', 'title', 'rating', 'finished'] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`books.sort.${s}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="text-base text-text-3">{t('books.noneInFilter')}</p>
              ) : (
                <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9">
                  {shown.map((b, i) => (
                    <m.li key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 14) * 0.02, duration: 0.25 }}>
                      <button type="button" onClick={() => openBook(b)} className="group flex w-full flex-col gap-2 text-start">
                        <span className="relative block transition-transform duration-[var(--dur-base)] ease-standard group-hover:-translate-y-1">
                          <BookCover title={b.title} author={b.author} url={b.cover_url} mode={b.cover_mode} color={b.cover_color} />
                          {b.favorite && (
                            <span className="absolute end-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/45">
                              <Heart size={12} className="fill-white text-white" aria-label={t('books.favorite')} />
                            </span>
                          )}
                        </span>
                        <span className="line-clamp-2 font-reading text-[15px] leading-snug font-semibold text-text" dir="auto">
                          {b.title}
                        </span>
                        <span className="-mt-1 truncate text-sm text-text-3" dir="auto">
                          {b.author}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-text-3">
                          {filter === 'all' && <span>{t(`books.status.${b.status}`)}</span>}
                          <Stars value={b.rating} size={11} />
                        </span>
                      </button>
                    </m.li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageBody>

      <BookSheet book={open ?? null} onClose={() => navigate('/books')} />
      <AddBookDialog open={adding} onOpenChange={setAdding} onAdded={(b) => navigate(`/books/${b.id}`)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-border px-5 py-4 [&:not(:last-child)]:border-e max-md:[&:nth-child(2)]:border-e-0 max-md:[&:nth-child(-n+2)]:border-b">
      <span className="text-sm text-text-3">{label}</span>
      <span className="font-display text-2xl font-semibold text-text tabular">{value}</span>
    </div>
  );
}

/** Books finished per month: one series, so no legend; each bar has a tooltip and the numbers are in a table for screen readers. */
function MonthBars({ counts, year }: { counts: number[]; year: number }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const max = Math.max(1, ...counts);
  const month = (i: number) => new Intl.DateTimeFormat(intlLocale(lang), { month: 'short' }).format(new Date(year, i, 1));
  return (
    <div className="col-span-2 flex flex-col gap-2 border-border px-5 py-4 max-md:border-t md:col-span-1">
      <span className="text-sm text-text-3">{t('books.byMonth', { year })}</span>
      <div aria-hidden className="flex h-12 items-end gap-[3px]" dir="ltr">
        {counts.map((n, i) => (
          <span key={i} title={`${month(i)}: ${n}`} className="flex h-full flex-1 items-end">
            <span className={`block w-full rounded-t-[3px] ${n ? 'bg-accent' : 'bg-surface-3'}`} style={{ height: n ? `${Math.max(12, (n / max) * 100)}%` : '3px' }} />
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t('books.byMonth', { year })}</caption>
        <tbody>
          {counts.map((n, i) => (
            <tr key={i}>
              <th scope="row">{month(i)}</th>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
