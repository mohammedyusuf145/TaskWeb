import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Paperclip, Sparkles, Trash2, X } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/prefs';
import { playUi } from '@/lib/uiSound';
import { newId, softDelete, upsert } from '@/lib/db/repo';
import { useSubjects } from '@/lib/db/hooks';
import type { Flashcard } from '@/types/database';
import { Button, Checkbox, Dialog, Field, IconButton, Select, Textarea, toast } from '@/components/ui';
import { MathMarkdown } from '@/components/content/MathMarkdown';

import { useFlashcards } from '@/features/tutor/hooks';
import { newCardState, preview, review, type Grade } from '@/features/tutor/srs';
import { generateFlashcards, TutorError } from '@/features/tutor/api';
import { FileError, prepareFile, ACCEPT } from '@/features/tutor/files';
import { saveFlashcards } from '@/features/tutor/tools';
import { errorKey } from '@/features/tutor/ui/Conversation';
import type { UserBlock } from '@/features/tutor/protocol';

// ── Review ──────────────────────────────────────────────────────────────────

export function fmtInterval(ms: number, t: ReturnType<typeof useT>): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return t('fc.in.min', { n: Math.max(1, min) });
  const h = Math.round(min / 60);
  if (h < 24) return t('fc.in.h', { n: h });
  return t('fc.in.d', { n: Math.round(h / 24) });
}

/**
 * A study session. `review` schedules each card with spaced repetition; `practice` only drills
 * (nothing is rescheduled), with an optional reversed direction (answer first).
 */
export function Review({ ids, onClose, mode = 'review', reverse = false }: { ids: string[]; onClose: () => void; mode?: 'review' | 'practice'; reverse?: boolean }) {
  const t = useT();
  const all = useFlashcards();
  const reduced = useReducedMotion();
  const [queue, setQueue] = useState(ids);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [knew, setKnew] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(() => new Set());
  const raw = all?.find((c) => c.id === queue[0]);
  const card = raw && reverse ? { ...raw, front: raw.back, back: raw.front } : raw;
  const total = ids.length;

  const grade = async (g: Grade) => {
    if (!card || !raw || !shown) return;
    if (mode === 'review') await upsert('flashcards', { id: raw.id, ...review(raw, g) });
    playUi(g === 'again' ? 'tap' : 'complete');
    if (mode === 'practice') {
      if (g === 'again') setMissed((m) => new Set(m).add(raw.id));
      else if (!missed.has(raw.id)) setKnew((k) => k + 1);
    }
    setShown(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === 'again' ? [...rest, raw.id] : rest; // missed cards come back this session
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
      const map: Record<string, Grade> = mode === 'practice' ? { '1': 'again', '2': 'good' } : { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      if (map[e.key]) void grade(map[e.key]!);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finished = all && !card;
  const grades: { g: Grade; key: string; tone: string; label?: string }[] =
    mode === 'practice'
      ? [
          { g: 'again', key: '1', tone: 'hover:border-danger/60', label: t('fc.practice.missed') },
          { g: 'good', key: '2', tone: 'hover:border-success/60', label: t('fc.practice.knew') },
        ]
      : [
          { g: 'again', key: '1', tone: 'hover:border-danger/60' },
          { g: 'hard', key: '2', tone: 'hover:border-warning/60' },
          { g: 'good', key: '3', tone: 'hover:border-success/60' },
          { g: 'easy', key: '4', tone: 'hover:border-accent/60' },
        ];
  const pv = raw && mode === 'review' ? preview(raw) : null;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <IconButton label={t('c.close')} icon={<X size={18} />} onClick={onClose} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <m.div className="h-full rounded-full bg-accent" animate={{ width: `${(done / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <span className="text-sm text-text-3 tabular" dir="ltr">
          {done}/{total}
        </span>
      </div>

      {finished ? (
        <m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-16 flex flex-col items-center text-center">
          <span className="pearl mb-5 size-16 rounded-full shadow-lift" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-text">{t('fc.done.title')}</h2>
          <p className="mt-2 max-w-[360px] text-text-2">{mode === 'practice' ? t('fc.practice.score', { n: knew, total }) : t('fc.done.body')}</p>
          <Button variant="primary" className="mt-6" onClick={onClose}>
            {t('c.done')}
          </Button>
        </m.div>
      ) : card ? (
        <>
          <div className="relative mt-8 [perspective:1400px]">
            <AnimatePresence mode="wait" initial={false}>
              <m.button
                key={card.id + String(queue.length)}
                type="button"
                onClick={() => setShown(true)}
                aria-label={shown ? undefined : t('fc.reveal')}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="relative block min-h-[300px] w-full text-start [transform-style:preserve-3d]"
              >
                <m.div
                  className="absolute inset-0 [transform-style:preserve-3d]"
                  animate={{ rotateY: shown && !reduced ? 180 : 0 }}
                  transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
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
                </m.div>
              </m.button>
            </AnimatePresence>
          </div>
          <div className={cn('mt-6 grid gap-2', mode === 'practice' ? 'grid-cols-2' : 'grid-cols-4')}>
            {grades.map(({ g, key, tone, label }) => (
              <button
                key={g}
                type="button"
                disabled={!shown}
                onClick={() => void grade(g)}
                aria-keyshortcuts={key}
                className={cn(
                  'press flex flex-col items-center gap-0.5 rounded-[10px] border border-border bg-surface-1 py-3 transition-[border-color,opacity] disabled:opacity-35',
                  tone,
                )}
              >
                <span className="text-base font-medium text-text">{label ?? t(`fc.${g}`)}</span>
                <span className="text-xs text-text-3 tabular">{pv ? fmtInterval(pv[g], t) : key}</span>
              </button>
            ))}
          </div>
          {!shown && (
            <Button variant="primary" size="lg" className="mt-3" block onClick={() => setShown(true)}>
              {t('fc.reveal')}
            </Button>
          )}
          <p className="mt-4 text-center text-xs text-text-3 max-md:hidden">{mode === 'practice' ? t('fc.practice.keys') : t('fc.keys')}</p>
        </>
      ) : null}
    </div>
  );
}

function Face({ children, back, hidden }: { children: React.ReactNode; back?: boolean; hidden?: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col overflow-y-auto rounded-[16px] border border-border-strong bg-surface-2 p-6 shadow-lift [backface-visibility:hidden] md:p-8',
        hidden && 'invisible',
      )}
      style={back ? { transform: 'rotateY(180deg)' } : undefined}
    >
      {children}
    </div>
  );
}

// ── Edit / add ──────────────────────────────────────────────────────────────

export function CardEditor({ card, defaultSubject, onClose }: { card: Flashcard | 'new' | null; defaultSubject: string | null; onClose: () => void }) {
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

export function GenerateDialog({ open, onOpenChange, defaultSubject }: { open: boolean; onOpenChange: (v: boolean) => void; defaultSubject: string | null }) {
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
              <li key={i} className="flex gap-3 rounded-[8px] border border-border bg-surface-1 p-3">
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

