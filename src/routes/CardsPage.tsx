import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import * as m from 'motion/react-m';
import { FileUp, Layers, Play, Plus, Search, Shuffle, Sparkles } from 'lucide-react';
import { useI18n, useT, intlLocale } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useSubjects } from '@/lib/db/hooks';
import { subjectColor } from '@/design/tokens';
import { playUi } from '@/lib/uiSound';
import type { Flashcard } from '@/types/database';
import { Button, Dialog, EmptyState, Field, Input, Segmented, Select, Skeleton, Switch, Textarea, toast } from '@/components/ui';
import { MathMarkdown } from '@/components/content/MathMarkdown';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';
import { useFlashcards } from '@/features/tutor/hooks';
import { isDue } from '@/features/tutor/srs';
import { tutorAvailable } from '@/features/tutor/api';
import { saveFlashcards } from '@/features/tutor/tools';
import { CardEditor, GenerateDialog, Review } from '@/features/flashcards/parts';
import { deckStats, forecast, parseImport, shuffle, stage, type Stage } from '@/features/flashcards/deck';

type Session = { ids: string[]; mode: 'review' | 'practice'; reverse: boolean };
const GENERAL = 'general';

/** Flashcards: the overview, decks per subject, browsing and two ways to study. */
export function CardsPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const cards = useFlashcards();
  const subjects = useSubjects();
  const online = useAuth((s) => s.mode) === 'cloud' && tutorAvailable();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [deck, setDeck] = useState<string>('all');
  const now = new Date();

  const stats = useMemo(() => deckStats(cards ?? [], new Date()), [cards]);
  const days = useMemo(() => forecast(cards ?? [], 7, new Date()), [cards]);
  const decks = useMemo(() => {
    const groups = new Map<string, Flashcard[]>();
    for (const c of cards ?? []) {
      const k = c.subject_id ?? GENERAL;
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    return [...groups.entries()]
      .map(([id, list]) => ({ id, subject: subjects?.find((s) => s.id === id), list, stats: deckStats(list, now) }))
      .sort((a, b) => b.stats.due - a.stats.due || b.list.length - a.list.length);
  }, [cards, subjects]);

  const inDeck = (c: Flashcard) => deck === 'all' || (c.subject_id ?? GENERAL) === deck;
  const study = (mode: Session['mode'], list: Flashcard[]) => {
    const pool = mode === 'review' ? list.filter((c) => isDue(c, new Date())) : list;
    if (!pool.length) return;
    setSession({ ids: (mode === 'practice' ? shuffle(pool) : pool.sort((a, b) => a.due_at.localeCompare(b.due_at))).map((c) => c.id), mode, reverse: mode === 'practice' && reverse });
  };

  // Links from Today / the tutor: /cards?review=1 starts reviewing everything due.
  const wantsReview = Boolean(params.get('review'));
  useEffect(() => {
    if (!wantsReview || !cards) return;
    setParams((p) => (p.delete('review'), p), { replace: true });
    study('review', cards);
  }, [wantsReview, Boolean(cards)]);

  if (session) return <Review ids={session.ids} mode={session.mode} reverse={session.reverse} onClose={() => setSession(null)} />;

  const shown = (cards ?? [])
    .filter(inDeck)
    .filter((c) => stageFilter === 'all' || stage(c) === stageFilter)
    .filter((c) => !query.trim() || `${c.front}\n${c.back}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const nf = new Intl.NumberFormat(intlLocale(lang));
  const day = (i: number) => (i === 0 ? t('fc.ov.today') : new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'short' }).format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)));
  const maxDay = Math.max(1, ...days);

  return (
    <>
      <PageHeader
        title={t('nav.cards')}
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="max-sm:hidden" iconStart={<FileUp size={15} />} onClick={() => setImporting(true)}>
              <span className="max-md:sr-only">{t('fc.import')}</span>
            </Button>
            {online && (
              <Button size="sm" variant="ghost" className="max-sm:hidden" iconStart={<Sparkles size={15} />} onClick={() => setGenerating(true)}>
                <span className="max-md:sr-only">{t('fc.generate')}</span>
              </Button>
            )}
            <Button size="sm" variant="primary" iconStart={<Plus size={15} />} onClick={() => setEditing('new')}>
              <span className="max-sm:sr-only">{t('fc.add')}</span>
            </Button>
          </div>
        }
      />
      <PageBody>
        {!cards ? (
          <Skeleton className="h-32" />
        ) : cards.length === 0 ? (
          <EmptyState
            icon={<Layers size={20} />}
            title={t('fc.empty.title')}
            body={t('fc.empty.body')}
            action={
              <>
                <Button variant="primary" iconStart={<Plus size={16} />} onClick={() => setEditing('new')}>
                  {t('fc.add')}
                </Button>
                <Button iconStart={<FileUp size={16} />} onClick={() => setImporting(true)}>
                  {t('fc.import')}
                </Button>
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-10">
            {/* Overview: what's due now and what's coming */}
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="flex flex-col justify-between gap-5 rounded-[12px] border border-border bg-surface-1 p-5">
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="text-sm text-text-3">{t('fc.ov.due')}</p>
                    <p className="font-display text-4xl text-text tabular">{nf.format(stats.due)}</p>
                  </div>
                  <dl className="flex gap-6 pb-1.5">
                    {(['new', 'learning', 'mature'] as const).map((k) => (
                      <div key={k}>
                        <dt className="text-sm text-text-3">{t(`fc.ov.${k}`)}</dt>
                        <dd className="text-xl text-text tabular">{nf.format(stats[k])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-sm text-text-3">
                    <span>{t('fc.ov.mastery', { n: Math.round(stats.mastery * 100) })}</span>
                    <span className="tabular">{t('fc.deck.cards', { n: nf.format(stats.total) })}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${t('fc.ov.new')} ${stats.new}, ${t('fc.ov.learning')} ${stats.learning}, ${t('fc.ov.mature')} ${stats.mature}`}>
                    <span className="bg-success" style={{ width: `${(stats.mature / stats.total) * 100}%` }} />
                    <span className="bg-accent" style={{ width: `${(stats.learning / stats.total) * 100}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" iconStart={<Play size={15} />} disabled={!stats.due} onClick={() => study('review', cards)}>
                    {t('fc.review', { n: stats.due })}
                  </Button>
                  <Button iconStart={<Shuffle size={15} />} onClick={() => study('practice', cards)}>
                    {t('fc.practice')}
                  </Button>
                  <div className="ms-auto">
                    <Switch checked={reverse} onCheckedChange={setReverse} label={<span className="text-sm text-text-2">{t('fc.reverse')}</span>} />
                  </div>
                </div>
              </div>
              <div className="rounded-[12px] border border-border bg-surface-1 p-5">
                <p className="mb-4 text-sm text-text-3">{t('fc.ov.forecast')}</p>
                <div className="flex h-28 items-end gap-2" aria-hidden>
                  {days.map((n, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${day(i)}: ${n}`}>
                      <span className="text-xs text-text-3 tabular">{n || ''}</span>
                      <m.span
                        initial={{ height: 0 }}
                        animate={{ height: n ? `${Math.max(8, (n / maxDay) * 100)}%` : 3 }}
                        transition={{ duration: 0.5, delay: i * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
                        className={cn('block w-full max-w-6 rounded-t-[4px]', i === 0 ? 'bg-accent' : n ? 'bg-text-3/50' : 'bg-surface-3')}
                      />
                      <span className="text-xs text-text-3">{day(i)}</span>
                    </div>
                  ))}
                </div>
                <table className="sr-only">
                  <caption>{t('fc.ov.forecast')}</caption>
                  <tbody>
                    {days.map((n, i) => (
                      <tr key={i}>
                        <th scope="row">{day(i)}</th>
                        <td>{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Decks per subject */}
            <section aria-labelledby="decks">
              <h2 id="decks" className="mb-4 text-lg text-text">
                {t('fc.decks')}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {decks.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface-1 p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.subject ? subjectColor(d.subject.color) : 'var(--text-3)' }} />
                      <span className="min-w-0 flex-1 truncate text-md font-medium text-text">{d.subject?.name ?? t('tutor.general')}</span>
                      <span className="text-sm text-text-3 tabular">{t('fc.deck.cards', { n: d.list.length })}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-success" style={{ width: `${d.stats.mastery * 100}%` }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm', d.stats.due ? 'text-accent-text' : 'text-text-3')}>{d.stats.due ? t('fc.deck.due', { n: d.stats.due }) : t('fc.deck.none')}</span>
                      <span className="flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => study('practice', d.list)}>
                        {t('fc.practice')}
                      </Button>
                      <Button size="sm" variant={d.stats.due ? 'primary' : 'secondary'} disabled={!d.stats.due} onClick={() => study('review', d.list)}>
                        {t('fc.review', { n: d.stats.due })}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Browse */}
            <section aria-labelledby="browse">
              <div className="mb-4 flex items-center gap-2">
                <h2 id="browse" className="flex-1 text-lg text-text">
                  {t('fc.browse')}
                </h2>
                <Button size="sm" variant="ghost" className="sm:hidden" iconStart={<FileUp size={15} />} onClick={() => setImporting(true)}>
                  {t('fc.import')}
                </Button>
                {online && (
                  <Button size="sm" variant="ghost" className="sm:hidden" iconStart={<Sparkles size={15} />} onClick={() => setGenerating(true)}>
                    {t('fc.generate')}
                  </Button>
                )}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-3" />
                  <Input aria-label={t('fc.search')} placeholder={t('fc.search')} value={query} onChange={(e) => setQuery(e.target.value)} className="!ps-9" dir="auto" />
                </div>
                <div className="w-44">
                  <Select aria-label={t('fc.decks')} value={deck} onChange={(e) => setDeck(e.target.value)}>
                    <option value="all">{t('fc.allSubjects')}</option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.subject?.name ?? t('tutor.general')}
                      </option>
                    ))}
                  </Select>
                </div>
                <Segmented
                  label={t('fc.col.stage')}
                  value={stageFilter}
                  onValueChange={setStageFilter}
                  className="[&>*]:px-2.5 [&>*]:text-sm"
                  options={(['all', 'new', 'learning', 'mature'] as const).map((s) => ({ value: s, label: t(`fc.stage.${s}`) }))}
                />
              </div>
              {shown.length === 0 ? (
                <p className="py-6 text-base text-text-3">{t('fc.noMatch')}</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-surface-1">
                  {shown.slice(0, 300).map((c) => {
                    const st = stage(c);
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => setEditing(c)} className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-start hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_110px] md:items-center md:gap-4">
                          <MathMarkdown className="line-clamp-2 font-medium [&_p]:m-0">{c.front}</MathMarkdown>
                          <MathMarkdown className="line-clamp-2 text-text-2 [&_p]:m-0">{c.back}</MathMarkdown>
                          <span className={cn('text-sm', st === 'mature' ? 'text-success' : st === 'learning' ? 'text-accent-text' : 'text-text-3')}>{t(`fc.stage.${st}`)}</span>
                          <span className={cn('text-sm tabular', isDue(c, now) ? 'text-accent-text' : 'text-text-3')}>
                            {isDue(c, now) ? t('fc.due') : new Intl.DateTimeFormat(intlLocale(lang), { day: 'numeric', month: 'short' }).format(new Date(c.due_at))}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageBody>

      <CardEditor card={editing} defaultSubject={deck === 'all' || deck === GENERAL ? null : deck} onClose={() => setEditing(null)} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      {online && <GenerateDialog open={generating} onOpenChange={setGenerating} defaultSubject={deck === 'all' || deck === GENERAL ? null : deck} />}
    </>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT();
  const subjects = useSubjects();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const parsed = useMemo(() => parseImport(text), [text]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fc.import.title')}
      className="max-w-[560px]"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('c.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!parsed.cards.length}
            onClick={async () => {
              const n = await saveFlashcards(parsed.cards, subject || null);
              playUi('create');
              toast(t('fc.imported', { n }), { tone: 'success' });
              setText('');
              onOpenChange(false);
            }}
          >
            {t('fc.import.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('fc.generate.paste')} hint={t('fc.import.hint')}>
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} value={text} onChange={(e) => setText(e.target.value)} dir="auto" className="min-h-[180px] font-mono text-sm" placeholder={'H2O ; water\nالخلية - وحدة بناء الكائن الحي'} />
          )}
        </Field>
        <Field label={t('tutor.panel.subject')}>
          {({ id }) => (
            <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">{t('tutor.general')}</option>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {text.trim() && <p className="text-sm text-text-2">{t('fc.import.preview', { n: parsed.cards.length, s: parsed.skipped })}</p>}
      </div>
    </Dialog>
  );
}
