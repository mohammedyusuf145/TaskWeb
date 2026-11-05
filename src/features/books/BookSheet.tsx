import { useState, type ReactNode } from 'react';
import * as m from 'motion/react-m';
import { Heart, Plus, Quote, Trash2, X } from 'lucide-react';
import { CoverPicker } from './CoverPicker';
import { useT } from '@/lib/i18n';

import { useAutosave } from '@/lib/useAutosave';
import { playUi } from '@/lib/uiSound';
import type { Book, BookStatus } from '@/types/database';
import { Button, Dialog, IconButton, Input, Segmented, Select, Sheet, Textarea, toast } from '@/components/ui';
import { Markdown } from '@/components/content/Markdown';
import { BookCover } from './BookCover';
import { StarInput } from './Stars';
import { addQuote, deleteBook, removeQuote, updateBook } from './data';
import { progress, statusPatch } from './logic';

/** Everything about one book, editable in place; changes save as you go. */
export function BookSheet({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={book !== null} onOpenChange={(v) => !v && onClose()} title={book?.title ?? t('books.add')} width={560}>
      {book && <BookBody key={book.id} book={book} onClose={onClose} />}
    </Sheet>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-border py-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-2">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function BookBody({ book, onClose }: { book: Book; onClose: () => void }) {
  const t = useT();
  const title = useAutosave(book.title, (v) => (v.trim() ? updateBook(book.id, { title: v.trim().slice(0, 300) }) : undefined));
  const author = useAutosave(book.author, (v) => updateBook(book.id, { author: v.trim().slice(0, 200) }));
  const genre = useAutosave(book.genre, (v) => updateBook(book.id, { genre: v.trim().slice(0, 80) }));
  const notes = useAutosave(book.notes, (v) => updateBook(book.id, { notes: v.slice(0, 50000) }), 700);
  const [preview, setPreview] = useState(false);
  const [quote, setQuote] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const p = progress(book);

  const setStatus = (s: BookStatus) => {
    void updateBook(book.id, statusPatch(book, s));
    if (s === 'finished' && book.status !== 'finished') playUi('complete');
  };
  const num = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return (
    <div className="flex flex-col">
      <div className="flex gap-4 pb-5">
        <div className="w-24 shrink-0 sm:w-28">
          <BookCover title={book.title} author={book.author} url={book.cover_url} mode={book.cover_mode} color={book.cover_color} size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            aria-label={t('books.title')}
            value={title.value}
            onChange={(e) => title.onChange(e.target.value)}
            onBlur={title.onBlur}
            dir="auto"
            className="w-full rounded-[6px] bg-transparent font-reading text-xl font-semibold text-text outline-none focus-visible:bg-surface-2"
          />
          <input
            aria-label={t('books.author')}
            value={author.value}
            placeholder={t('books.author')}
            onChange={(e) => author.onChange(e.target.value)}
            onBlur={author.onBlur}
            dir="auto"
            className="w-full rounded-[6px] bg-transparent text-base text-text-2 outline-none placeholder:text-text-3 focus-visible:bg-surface-2"
          />
          <div className="mt-2 flex items-center gap-1">
            <StarInput value={book.rating} onChange={(rating) => void updateBook(book.id, { rating })} />
            <IconButton
              size="sm"
              label={t('books.favorite')}
              active={book.favorite}
              aria-pressed={book.favorite}
              icon={<Heart size={16} className={book.favorite ? 'fill-danger text-danger' : undefined} />}
              onClick={() => void updateBook(book.id, { favorite: !book.favorite })}
            />
          </div>
        </div>
      </div>

      <Segmented
        label={t('books.status')}
        value={book.status}
        onValueChange={setStatus}
        className="w-full [&>*]:flex-1 [&>*]:px-1.5 [&>*]:text-sm"
        options={(['want', 'reading', 'finished', 'dropped'] as const).map((s) => ({ value: s, label: t(`books.status.${s}`) }))}
      />

      <Section title={t('books.cover')}>
        <CoverPicker
          layout="row"
          title={book.title}
          author={book.author}
          value={{ mode: book.cover_mode, url: book.cover_url, color: book.cover_color }}
          onChange={(v) => void updateBook(book.id, { cover_mode: v.mode, cover_url: v.url, cover_color: v.color })}
        />
      </Section>

      <Section title={t('books.progress')}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.currentPage')}
            <Input
              inputMode="numeric"
              dir="ltr"
              value={book.current_page || ''}
              onChange={(e) => {
                const n = num(e.target.value) ?? 0;
                void updateBook(book.id, { current_page: book.pages ? Math.min(n, book.pages) : n });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.pages')}
            <Input inputMode="numeric" dir="ltr" value={book.pages ?? ''} onChange={(e) => void updateBook(book.id, { pages: num(e.target.value) || null })} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.started')}
            <Input type="date" dir="ltr" value={book.started_on ?? ''} max={book.finished_on ?? undefined} onChange={(e) => void updateBook(book.id, { started_on: e.target.value || null })} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.finishedOn')}
            <Input
              type="date"
              dir="ltr"
              value={book.finished_on ?? ''}
              min={book.started_on ?? undefined}
              disabled={book.status !== 'finished'}
              onChange={(e) => e.target.value && void updateBook(book.id, { finished_on: e.target.value })}
            />
          </label>
        </div>
        {p !== null && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={t('books.progress')}>
            <m.div className="h-full rounded-full bg-accent" animate={{ width: `${p * 100}%` }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }} />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.genre')}
            <Input value={genre.value} onChange={(e) => genre.onChange(e.target.value)} onBlur={genre.onBlur} dir="auto" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-3">
            {t('books.language')}
            <Select value={book.language ?? ''} onChange={(e) => void updateBook(book.id, { language: (e.target.value || null) as Book['language'] })}>
              <option value="">—</option>
              {(['ar', 'en', 'other'] as const).map((l) => (
                <option key={l} value={l}>
                  {t(`books.language.${l}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Section>

      <Section
        title={t('books.notes')}
        action={
          <Segmented
            label={t('books.notes')}
            value={preview ? 'p' : 'w'}
            onValueChange={(v) => {
              notes.flush();
              setPreview(v === 'p');
            }}
            className="[&>*]:h-7 [&>*]:px-2.5 [&>*]:text-sm"
            options={[
              { value: 'w', label: t('books.notes.edit') },
              { value: 'p', label: t('books.notes.preview') },
            ]}
          />
        }
      >
        {preview ? (
          <div className="min-h-[120px] rounded-[10px] border border-border bg-surface-1 px-4 py-3">
            {notes.value.trim() ? <Markdown className="font-reading text-[15px]">{notes.value}</Markdown> : <p className="text-sm text-text-3">{t('books.notes.placeholder')}</p>}
          </div>
        ) : (
          <Textarea
            aria-label={t('books.notes')}
            value={notes.value}
            onChange={(e) => notes.onChange(e.target.value)}
            onBlur={notes.onBlur}
            placeholder={t('books.notes.placeholder')}
            dir="auto"
            className="min-h-[160px] font-reading text-[15px] leading-relaxed"
          />
        )}
      </Section>

      <Section title={t('books.quotes')}>
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!quote.trim()) return;
            await addQuote(book, quote, num(quotePage));
            playUi('create');
            setQuote('');
            setQuotePage('');
          }}
        >
          <Textarea aria-label={t('books.quote.text')} placeholder={t('books.quote.text')} value={quote} onChange={(e) => setQuote(e.target.value)} dir="auto" className="min-h-[72px] font-reading" />
          <div className="flex items-center gap-2">
            <Input aria-label={t('books.quote.page')} placeholder={t('books.quote.page')} inputMode="numeric" dir="ltr" value={quotePage} onChange={(e) => setQuotePage(e.target.value)} className="!w-28" />
            <Button type="submit" size="md" variant="secondary" disabled={!quote.trim()} iconStart={<Plus size={15} />}>
              {t('books.quote.add')}
            </Button>
          </div>
        </form>
        {book.quotes.length === 0 ? (
          <p className="mt-3 text-sm text-text-3">{t('books.quotes.empty')}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {book.quotes.map((q) => (
              <li key={q.id} className="group relative rounded-[10px] border border-border bg-surface-1 px-4 py-3 pe-10">
                <Quote size={14} className="mb-1 text-accent-text" aria-hidden />
                <blockquote className="font-reading text-[15px] leading-relaxed whitespace-pre-wrap text-text" dir="auto">
                  {q.text}
                </blockquote>
                {q.page !== null && <p className="mt-1 text-xs text-text-3">{t('books.pageN', { n: q.page })}</p>}
                <span className="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
                  <IconButton size="sm" label={t('books.quote.remove')} icon={<X size={14} />} onClick={() => void removeQuote(book, q.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="border-t border-border pt-5">
        <Button variant="danger" iconStart={<Trash2 size={15} />} onClick={() => setConfirm(true)}>
          {t('books.delete')}
        </Button>
      </div>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('books.delete.confirm', { title: book.title })}
        description={t('books.delete.body')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t('c.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteBook(book.id);
                toast(t('books.deleted'));
                setConfirm(false);
                onClose();
              }}
            >
              {t('books.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
