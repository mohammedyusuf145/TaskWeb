import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layers, Paperclip, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/prefs';
import { playUi } from '@/lib/uiSound';
import { newId, softDelete, upsert } from '@/lib/db/repo';
import { useSubjects } from '@/lib/db/hooks';
import type { Flashcard } from '@/types/database';
import { Button, Checkbox, Dialog, EmptyState, Field, IconButton, Select, Textarea, toast } from '@/components/ui';
import { MathMarkdown } from '@/components/content/MathMarkdown';
import { SubjectDot } from '@/features/subjects/SubjectChip';
import { useFlashcards } from '../hooks';
import { isDue, newCardState, preview, review, type Grade } from '../srs';
import { generateFlashcards, TutorError, tutorAvailable } from '../api';
import { FileError, prepareFile, ACCEPT } from '../files';
import { saveFlashcards } from '../tools';
import { errorKey } from './Conversation';
import type { UserBlock } from '../protocol';

export function FlashcardsView({ reviewNow, onReviewHandled, canGenerate }: { reviewNow?: number; onReviewHandled?: () => void; canGenerate: boolean }) {
  const t = useT();
  const all = useFlashcards();
  const subjects = useSubjects();
  const [subject, setSubject] = useState<string>('all');
  const [reviewing, setReviewing] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null);
  const [generating, setGenerating] = useState(false);
  const now = new Date();

  const cards = useMemo(() => (all ?? []).filter((c) => subject === 'all' || (c.subject_id ?? 'none') === subject), [all, subject]);
  const due = cards.filter((c) => isDue(c, now));

  useEffect(() => {
    if (!reviewNow || !all) return;
    const ids = all.filter((c) => isDue(c, new Date())).map((c) => c.id);
    setReviewing(ids);
    onReviewHandled?.();
  }, [reviewNow, Boolean(all)]);

  if (reviewing) return <Review ids={reviewing} onClose={() => setReviewing(null)} />;

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-56">
          <Select aria-label={t('settings.subjects')} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">{t('fc.allSubjects')}</option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-text-3">{t('fc.dueCount', { due: due.length, total: cards.length })}</p>
        <span className="flex-1" />
        <Button variant="ghost" iconStart={<Plus size={16} />} onClick={() => setEditing('new')}>
          {t('fc.add')}
        </Button>
        {canGenerate && (
          <Button variant="secondary" iconStart={<Sparkles size={16} />} onClick={() => setGenerating(true)}>
            {t('fc.generate')}
          </Button>
        )}
        <Button variant="primary" disabled={due.length === 0} onClick={() => setReviewing(due.map((c) => c.id))}>
          {t('fc.review', { n: due.length })}
        </Button>
      </div>

      {all && cards.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<Layers size={20} />}
          title={t('fc.empty.title')}
          body={t('fc.empty.body')}
          action={
            <Button variant="primary" iconStart={<Plus size={16} />} onClick={() => setEditing('new')}>
              {t('fc.add')}
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards
            .slice()
            .sort((a, b) => a.due_at.localeCompare(b.due_at))
            .map((c, i) => {
              const s = subjects?.find((x) => x.id === c.subject_id);
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="group lift relative flex min-h-[132px] flex-col rounded-[16px] border border-border bg-surface-1 p-4"
                >
                  <MathMarkdown className="line-clamp-3 font-medium">{c.front}</MathMarkdown>
                  <MathMarkdown className="mt-2 line-clamp-2 text-sm text-text-3">{c.back}</MathMarkdown>
                  <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-text-3">
                    {s && <SubjectDot color={s.color} size={6} />}
                    <span className="truncate">{s?.name ?? t('tutor.general')}</span>
                    {isDue(c, now) && <span className="ms-auto rounded-full bg-accent-soft px-2 py-0.5 text-accent-text">{t('fc.due')}</span>}
                  </div>
                  <div className="absolute end-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
                    <IconButton size="sm" label={t('fc.edit')} icon={<Pencil size={14} />} onClick={() => setEditing(c)} />
                  </div>
                </motion.li>
              );
            })}
        </ul>
      )}

      <CardEditor card={editing} defaultSubject={subject === 'all' || subject === 'none' ? null : subject} onClose={() => setEditing(null)} />
      {canGenerate && <GenerateDialog open={generating} onOpenChange={setGenerating} defaultSubject={subject === 'all' ? null : subject} />}
    </div>
  );
}

// ── Review ──────────────────────────────────────────────────────────────────

function fmtInterval(ms: number, t: ReturnType<typeof useT>): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return t('fc.in.min', { n: Math.max(1, min) });
  const h = Math.round(min / 60);
  if (h < 24) return t('fc.in.h', { n: h });
  return t('fc.in.d', { n: Math.round(h / 24) });
}

function Review({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const t = useT();
  const all = useFlashcards();
  const reduced = useReducedMotion();
  const [queue, setQueue] = useState(ids);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const card = all?.find((c) => c.id === queue[0]);
  const total = ids.length;

  const grade = async (g: Grade) => {
    if (!card || !shown) return;
    const next = review(card, g);
    await upsert('flashcards', { id: card.id, ...next });
    playUi(g === 'again' ? 'tap' : 'complete');
    setShown(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === 'again' ? [...rest, card.id] : rest; // missed cards come back this session
    });
    if (g !== 'again') setDone((d) => d + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShown(true);
      }
      const map: Record<string, Grade> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      if (map[e.key]) void grade(map[e.key]!);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finished = all && !card;
  const grades: { g: Grade; key: string; tone: string }[] = [
    { g: 'again', key: '1', tone: 'hover:border-danger/60' },
    { g: 'hard', key: '2', tone: 'hover:border-warning/60' },
    { g: 'good', key: '3', tone: 'hover:border-success/60' },
    { g: 'easy', key: '4', tone: 'hover:border-accent/60' },
  ];
  const pv = card ? preview(card) : null;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <IconButton label={t('c.close')} icon={<X size={18} />} onClick={onClose} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(done / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <span className="text-sm text-text-3 tabular" dir="ltr">
          {done}/{total}
        </span>
      </div>

      {finished ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-16 flex flex-col items-center text-center">
          <span className="pearl mb-5 size-16 rounded-full shadow-lift" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-text">{t('fc.done.title')}</h2>
          <p className="mt-2 max-w-[360px] text-text-2">{t('fc.done.body')}</p>
          <Button variant="primary" className="mt-6" onClick={onClose}>
            {t('c.done')}
          </Button>
        </motion.div>
      ) : card ? (
        <>
          <div className="relative mt-8 [perspective:1400px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.button
                key={card.id + String(queue.length)}
                type="button"
                onClick={() => setShown(true)}
                aria-label={shown ? undefined : t('fc.reveal')}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40, rotate: 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -60, rotate: -3 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="relative block min-h-[300px] w-full text-start [transform-style:preserve-3d]"
              >
                <motion.div
                  className="absolute inset-0 [transform-style:preserve-3d]"
                  animate={{ rotateY: shown && !reduced ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                >
                  <Face>
                    <p className="mb-3 text-xs text-text-3">{t('fc.front')}</p>
                    <MathMarkdown className="text-xl font-medium">{card.front}</MathMarkdown>
                    {!shown && <p className="mt-auto pt-6 text-sm text-text-3">{t('fc.reveal')}</p>}
                  </Face>
                  <Face back={!reduced} hidden={reduced && !shown}>
                    <p className="mb-3 text-xs text-text-3">{t('fc.back')}</p>
                    <MathMarkdown className="text-lg text-text-2">{card.front}</MathMarkdown>
                    <div className="my-4 h-px bg-border" />
                    <MathMarkdown className="text-xl font-medium">{card.back}</MathMarkdown>
                  </Face>
                </motion.div>
              </motion.button>
            </AnimatePresence>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-2">
            {grades.map(({ g, key, tone }) => (
              <button
                key={g}
                type="button"
                disabled={!shown}
                onClick={() => void grade(g)}
                aria-keyshortcuts={key}
                className={cn(
                  'press flex flex-col items-center gap-0.5 rounded-[14px] border border-border bg-surface-1 py-3 transition-[border-color,opacity] disabled:opacity-35',
                  tone,
                )}
              >
                <span className="text-base font-medium text-text">{t(`fc.${g}`)}</span>
                <span className="text-xs text-text-3 tabular">{pv ? fmtInterval(pv[g], t) : ''}</span>
              </button>
            ))}
          </div>
          {!shown && (
            <Button variant="primary" size="lg" className="mt-3" block onClick={() => setShown(true)}>
              {t('fc.reveal')}
            </Button>
          )}
          <p className="mt-4 text-center text-xs text-text-3 max-md:hidden">{t('fc.keys')}</p>
        </>
      ) : null}
    </div>
  );
}

function Face({ children, back, hidden }: { children: React.ReactNode; back?: boolean; hidden?: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col overflow-y-auto rounded-[24px] border border-border-strong bg-surface-2 p-6 shadow-lift [backface-visibility:hidden] md:p-8',
        hidden && 'invisible',
      )}
      style={back ? { transform: 'rotateY(180deg)' } : undefined}
    >
      {children}
    </div>
  );
}

// ── Edit / add ──────────────────────────────────────────────────────────────

function CardEditor({ card, defaultSubject, onClose }: { card: Flashcard | 'new' | null; defaultSubject: string | null; onClose: () => void }) {
  const t = useT();
  const subjects = useSubjects();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subject, setSubject] = useState<string>('');
  useEffect(() => {
    if (!card) return;
    setFront(card === 'new' ? '' : card.front);
    setBack(card === 'new' ? '' : card.back);
    setSubject(card === 'new' ? (defaultSubject ?? '') : (card.subject_id ?? ''));
  }, [card]);
  const valid = front.trim() && back.trim();
  return (
    <Dialog
      open={card !== null}
      onOpenChange={(v) => !v && onClose()}
      title={card === 'new' ? t('fc.add') : t('fc.edit')}
      footer={
        <>
          {card && card !== 'new' && (
            <Button
              variant="danger"
              className="me-auto"
              iconStart={<Trash2 size={15} />}
              onClick={async () => {
                await softDelete('flashcards', [card.id]);
                toast(t('fc.deleted'));
                onClose();
              }}
            >
              {t('c.delete')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('c.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              const base = card === 'new' || !card ? { id: newId(), ...newCardState() } : { id: card.id };
              await upsert('flashcards', { ...base, front: front.trim().slice(0, 2000), back: back.trim().slice(0, 4000), subject_id: subject || null });
              playUi('create');
              toast(t('fc.saved'), { tone: 'success' });
              onClose();
            }}
          >
            {t('fc.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('fc.front')}>{({ id }) => <Textarea id={id} value={front} onChange={(e) => setFront(e.target.value)} dir="auto" className="min-h-[72px]" />}</Field>
        <Field label={t('fc.back')}>{({ id }) => <Textarea id={id} value={back} onChange={(e) => setBack(e.target.value)} dir="auto" className="min-h-[96px]" />}</Field>
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
      </div>
    </Dialog>
  );
}

// ── Generate from material ──────────────────────────────────────────────────

function GenerateDialog({ open, onOpenChange, defaultSubject }: { open: boolean; onOpenChange: (v: boolean) => void; defaultSubject: string | null }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const subjects = useSubjects();
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ block: UserBlock; name: string } | null>(null);
  const [count, setCount] = useState(10);
  const [subject, setSubject] = useState<string>(defaultSubject ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ front: string; back: string }[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  useEffect(() => {
    if (open) {
      setResult(null);
      setSubject(defaultSubject ?? '');
    }
  }, [open]);

  const run = async () => {
    setBusy(true);
    try {
      const material: UserBlock[] = [];
      if (file) material.push(file.block);
      if (text.trim()) material.push({ type: 'text', text: text.trim().slice(0, 24_000) });
      const cards = await generateFlashcards({ lang, count, subject: subjects?.find((s) => s.id === subject)?.name ?? '', material });
      setResult(cards);
      setPicked(cards.map(() => true));
    } catch (e) {
      playUi('error');
      toast(t(errorKey(e instanceof TutorError ? e.code : 'network')), { tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fc.generate.title')}
      className="max-w-[560px]"
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={() => setResult(null)}>
              {t('c.back')}
            </Button>
            <Button
              variant="primary"
              disabled={!picked.some(Boolean)}
              onClick={async () => {
                await saveFlashcards(result.filter((_, i) => picked[i]), subject || null);
                playUi('create');
                toast(t('tw.cards.saved'), { tone: 'success' });
                onOpenChange(false);
                setText('');
                setFile(null);
              }}
            >
              {t('tw.cards.save')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('c.cancel')}
            </Button>
            <Button variant="primary" loading={busy} disabled={!text.trim() && !file} iconStart={<Sparkles size={15} />} onClick={run}>
              {t('fc.generate.run')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div>
          <p className="mb-3 text-sm text-text-3">{t('fc.generate.result', { n: result.length })}</p>
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {result.map((c, i) => (
              <li key={i} className="flex gap-3 rounded-[12px] border border-border bg-surface-1 p-3">
                <Checkbox checked={picked[i] ?? false} onCheckedChange={(v) => setPicked((s) => s.map((x, j) => (j === i ? v : x)))} />
                <div className="min-w-0">
                  <MathMarkdown className="font-medium">{c.front}</MathMarkdown>
                  <MathMarkdown className="mt-1 text-sm text-text-2">{c.back}</MathMarkdown>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t('fc.generate.paste')} hint={t('fc.generate.paste.hint')}>
            {({ id }) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} dir="auto" className="min-h-[140px]" />}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {file ? (
              <span className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-1 ps-3 pe-1 text-sm text-text-2">
                <span className="max-w-[200px] truncate">{file.name}</span>
                <IconButton size="sm" label={t('tutor.removeFile', { name: file.name })} icon={<X size={13} />} onClick={() => setFile(null)} />
              </span>
            ) : (
              <label className="press inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-sm text-text-2 hover:border-border-strong hover:text-text">
                <Paperclip size={14} />
                {t('tutor.attach')}
                <input
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      const a = await prepareFile(f);
                      setFile({ block: a.block, name: a.meta.name });
                    } catch (err) {
                      toast(t(errorKey(err instanceof FileError ? err.message : 'unsupported')), { tone: 'danger' });
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('fc.generate.count')}>
              {({ id }) => (
                <Select id={id} value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
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
          </div>
        </div>
      )}
    </Dialog>
  );
}

export const canUseTutor = tutorAvailable;
