/**
 * In-chat cards for the tutor's tools. Nothing changes the student's data until they press
 * the button here; their decision goes back to the tutor as the tool's result.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CalendarClock, Check, CircleAlert, Flag, Layers, ListChecks, Pencil, X } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { formatDate, formatTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

import { useCard } from '@/lib/db/hooks';
import { Button, Checkbox, Textarea } from '@/components/ui';
import { MathMarkdown } from '@/components/content/MathMarkdown';
import { playUi } from '@/lib/uiSound';
import type { ToolUse } from '../protocol';
import { resolveTool } from '../engine';
import { applyCardUpdate, applyProposedCards, saveFlashcards } from '../tools';
import {
  dueFrom,
  flashcardsInput,
  normalizeAnswer,
  proposeCardsInput,
  quizInput,
  ToolInputError,
  updateCardInput,
  type QuizQuestion,
} from '../toolInput';

export interface WidgetProps {
  threadId: string;
  rowId: string;
  use: ToolUse;
  /** The result already sent or stored for this call, if any. */
  result: { content: string; is_error?: boolean } | null;
  /** False once the conversation has moved past this turn. */
  active: boolean;
  subjectId: string | null;
}

function Shell({ icon, title, children, tone = 'default' }: { icon: ReactNode; title: ReactNode; children: ReactNode; tone?: 'default' | 'muted' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className={cn('my-3 overflow-hidden rounded-[18px] border bg-surface-1', tone === 'muted' ? 'border-border' : 'border-border-strong shadow-card')}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium text-text-2">
        <span className="text-accent-text">{icon}</span>
        {title}
      </header>
      <div className="p-4">{children}</div>
    </motion.section>
  );
}

function Outcome({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={cn('mt-3 inline-flex items-center gap-1.5 text-sm', ok ? 'text-success' : 'text-text-3')}>
      {ok ? <Check size={14} /> : <X size={14} />}
      {children}
    </p>
  );
}

/** Reports schema problems back to the tutor once, so it can correct itself. */
function useInvalid(p: WidgetProps, parse: () => unknown): string | null {
  const err = useMemo(() => {
    try {
      parse();
      return null;
    } catch (e) {
      return e instanceof ToolInputError ? e.message : 'invalid input';
    }
  }, [p.use.id]);
  useEffect(() => {
    if (err && !p.result && p.active) void resolveTool(p.threadId, p.rowId, p.use.id, { content: `Invalid input: ${err}`, is_error: true });
  }, [err]);
  return err;
}

export function ToolWidget(p: WidgetProps) {
  switch (p.use.name) {
    case 'propose_cards':
      return <ProposeCards {...p} />;
    case 'update_card':
      return <UpdateCard {...p} />;
    case 'make_quiz':
      return <Quiz {...p} />;
    case 'make_flashcards':
      return <Flashcards {...p} />;
    default:
      return null; // automatic tools show up only as the activity line while running
  }
}

function InvalidNote() {
  const t = useT();
  return (
    <p className="my-2 inline-flex items-center gap-1.5 text-sm text-text-3">
      <CircleAlert size={14} /> {t('tw.invalid')}
    </p>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function ProposeCards(p: WidgetProps) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const err = useInvalid(p, () => proposeCardsInput(p.use.input));
  const input = useMemo(() => (err ? null : proposeCardsInput(p.use.input)), [err, p.use.id]);
  const [picked, setPicked] = useState<boolean[]>(() => input?.cards.map(() => true) ?? []);
  const [busy, setBusy] = useState(false);
  if (err || !input) return <InvalidNote />;
  const decided = p.result;
  const editable = p.active && !decided;

  const accept = async () => {
    setBusy(true);
    try {
      const chosen = input.cards.filter((_, i) => picked[i]);
      const created = await applyProposedCards(chosen, p.subjectId);
      playUi('create');
      await resolveTool(p.threadId, p.rowId, p.use.id, {
        content: JSON.stringify({ created: created.map((c) => ({ id: c.id, title: c.title })), skipped: input.cards.length - chosen.length }),
      });
    } catch (e) {
      const noBoard = e instanceof Error && e.message === 'no_board';
      await resolveTool(p.threadId, p.rowId, p.use.id, { content: noBoard ? 'The student has no board yet.' : 'Creating the cards failed on the device.', is_error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell icon={<ListChecks size={15} />} title={t('tw.propose.title')} tone={decided ? 'muted' : 'default'}>
      {input.reason && (
        <p className="mb-3 text-sm text-text-2" dir="auto">
          {input.reason}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {input.cards.map((c, i) => {
          const due = c.due_date ? new Date(dueFrom(c.due_date, c.due_time).due_at) : null;
          return (
            <li key={i} className="flex items-start gap-3 rounded-[12px] border border-border bg-surface-2 px-3 py-2.5">
              {editable && (
                <span className="pt-0.5">
                  <Checkbox checked={picked[i] ?? false} onCheckedChange={(v) => setPicked((s) => s.map((x, j) => (j === i ? v : x)))} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-text" dir="auto">
                  {c.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
                  {due && (
                    <span className="inline-flex items-center gap-1 tabular">
                      <CalendarClock size={12} />
                      {formatDate(due, lang)}
                      {c.due_time && ` ${formatTime(due, lang)}`}
                    </span>
                  )}
                  {c.subject && <span dir="auto">{c.subject}</span>}
                  {c.is_exam && (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <Flag size={11} /> {t('board.exam')}
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={accept} loading={busy} disabled={!picked.some(Boolean)} iconStart={<Check size={15} />}>
            {t('tw.propose.add')}
          </Button>
          <Button variant="ghost" onClick={() => void resolveTool(p.threadId, p.rowId, p.use.id, { content: 'The student declined; nothing was created.' })}>
            {t('tw.propose.decline')}
          </Button>
        </div>
      ) : decided ? (
        <Outcome ok={!decided.is_error && decided.content.startsWith('{')}>
          {decided.is_error && decided.content.includes('no board') ? t('tw.propose.noBoard') : decided.content.startsWith('{') ? t('tw.propose.added') : t('tw.propose.declined')}
        </Outcome>
      ) : null}
    </Shell>
  );
}

function UpdateCard(p: WidgetProps) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const err = useInvalid(p, () => updateCardInput(p.use.input));
  const input = useMemo(() => (err ? null : updateCardInput(p.use.input)), [err, p.use.id]);
  const card = useCard(input?.card_id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (card === null && input && !p.result && p.active) void resolveTool(p.threadId, p.rowId, p.use.id, { content: `No card with id ${input.card_id}.`, is_error: true });
  }, [card]);
  if (err || !input) return <InvalidNote />;
  if (card === undefined) return null;
  if (card === null)
    return (
      <p className="my-2 inline-flex items-center gap-1.5 text-sm text-text-3">
        <CircleAlert size={14} /> {t('tw.update.notFound')}
      </p>
    );
  const decided = p.result;
  const editable = p.active && !decided;
  const rows: [string, string, string][] = [];
  if (input.title !== null) rows.push([t('card.title'), card.title, input.title]);
  if (input.due_date !== null || input.due_time !== null) {
    const before = card.due_at ? `${formatDate(new Date(card.due_at), lang)}${card.due_has_time ? ` ${formatTime(new Date(card.due_at), lang)}` : ''}` : t('tw.update.noDate');
    const after =
      input.due_date === 'none'
        ? t('tw.update.noDate')
        : `${input.due_date ? formatDate(new Date(`${input.due_date}T12:00:00`), lang) : formatDate(new Date(card.due_at ?? Date.now()), lang)}${input.due_time && input.due_time !== 'none' ? ` ${input.due_time}` : ''}`;
    rows.push([t('card.due'), before, after]);
  }
  if (input.priority) rows.push([t('card.priority'), t(`pri.${card.priority}`), t(`pri.${input.priority}`)]);
  if (input.done !== null) rows.push([t('board.col.done'), card.completed_at ? t('tw.update.done') : t('tw.update.open'), input.done ? t('tw.update.done') : t('tw.update.open')]);
  if (input.notes !== null) rows.push([t('card.notes'), card.notes ? `${card.notes.slice(0, 60)}…` : '—', input.notes.slice(0, 120)]);

  return (
    <Shell icon={<Pencil size={15} />} title={t('tw.update.title')} tone={decided ? 'muted' : 'default'}>
      <p className="text-base font-medium text-text" dir="auto">
        {card.title}
      </p>
      {input.reason && (
        <p className="mt-1 text-sm text-text-2" dir="auto">
          {input.reason}
        </p>
      )}
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([k, a, b]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] gap-2 sm:grid-cols-[120px_1fr]">
            <dt className="text-text-3">{k}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-text-3 line-through decoration-text-3/60" dir="auto">
                {a}
              </span>
              <span className="text-text" dir="auto">
                {b}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={busy}
            iconStart={<Check size={15} />}
            onClick={async () => {
              setBusy(true);
              try {
                const c = await applyCardUpdate(input);
                playUi('tap');
                await resolveTool(p.threadId, p.rowId, p.use.id, { content: JSON.stringify({ updated: { id: c.id, title: c.title, due_at: c.due_at, done: Boolean(c.completed_at) } }) });
              } catch {
                await resolveTool(p.threadId, p.rowId, p.use.id, { content: 'Updating the card failed on the device.', is_error: true });
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('tw.update.apply')}
          </Button>
          <Button variant="ghost" onClick={() => void resolveTool(p.threadId, p.rowId, p.use.id, { content: 'The student declined; the card was not changed.' })}>
            {t('tw.propose.decline')}
          </Button>
        </div>
      ) : decided ? (
        <Outcome ok={decided.content.startsWith('{')}>{decided.content.startsWith('{') ? t('tw.update.applied') : t('tw.propose.declined')}</Outcome>
      ) : null}
    </Shell>
  );
}

// ── Quiz ────────────────────────────────────────────────────────────────────

interface Answered {
  answers: { n: number; kind: QuizQuestion['kind']; answer: string; correct?: boolean }[];
}

function Quiz(p: WidgetProps) {
  const t = useT();
  const err = useInvalid(p, () => quizInput(p.use.input));
  const quiz = useMemo(() => (err ? null : quizInput(p.use.input)), [err, p.use.id]);
  const [answers, setAnswers] = useState<string[]>(() => quiz?.questions.map(() => '') ?? []);
  const past = useMemo<Answered | null>(() => {
    try {
      return p.result && !p.result.is_error ? (JSON.parse(p.result.content) as Answered) : null;
    } catch {
      return null;
    }
  }, [p.result]);
  if (err || !quiz) return <InvalidNote />;
  const editable = p.active && !p.result;
  const shown = past ? past.answers.map((a) => a.answer) : answers;

  const submit = () => {
    const graded: Answered = {
      answers: quiz.questions.map((q, i) => ({
        n: i + 1,
        kind: q.kind,
        answer: answers[i]!.trim(),
        ...(q.kind === 'mcq' ? { correct: answers[i] === q.answer } : {}),
      })),
    };
    const right = graded.answers.filter((a) => a.correct).length;
    if (right > 0) playUi('complete');
    void resolveTool(p.threadId, p.rowId, p.use.id, {
      content: JSON.stringify({ ...graded, note: 'MCQ answers were checked on the device; grade the others, explain mistakes, then call record_topic_results.' }),
    });
  };

  return (
    <Shell icon={<ListChecks size={15} />} title={<span data-quiz>{quiz.title}</span>} tone={p.result ? 'muted' : 'default'}>
      <ol className="flex flex-col gap-5">
        {quiz.questions.map((q, i) => {
          const value = shown[i] ?? '';
          const graded = past?.answers[i];
          const shortMatch = q.kind !== 'mcq' && graded && normalizeAnswer(graded.answer) === normalizeAnswer(q.answer);
          return (
            <li key={i}>
              <p className="mb-1 text-xs text-text-3">{t('tw.quiz.q', { n: i + 1, total: quiz.questions.length })}</p>
              <MathMarkdown className="text-[15px]">{q.prompt}</MathMarkdown>
              {q.kind === 'mcq' ? (
                <div role="radiogroup" aria-label={t('tw.quiz.answer')} className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.choices.map((c) => {
                    const chosen = value === c;
                    const isRight = graded && c === q.answer;
                    const isWrong = graded && chosen && c !== q.answer;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        disabled={!editable}
                        onClick={() => setAnswers((s) => s.map((x, j) => (j === i ? c : x)))}
                        className={cn(
                          'press flex min-h-11 items-center gap-2 rounded-[12px] border px-3 py-2 text-start text-base transition-colors',
                          chosen && editable && 'border-accent bg-accent-soft text-text',
                          !chosen && editable && 'border-border bg-surface-2 text-text-2 hover:border-border-strong',
                          isRight && 'border-success bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-text',
                          isWrong && 'border-danger bg-danger-soft text-text',
                          !editable && !isRight && !isWrong && 'border-border bg-surface-2 text-text-3',
                        )}
                      >
                        <MathMarkdown className="!text-inherit [&_p]:m-0">{c}</MathMarkdown>
                        {isRight && <Check size={15} className="ms-auto shrink-0 text-success" />}
                        {isWrong && <X size={15} className="ms-auto shrink-0 text-danger" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  aria-label={t('tw.quiz.answer')}
                  className="mt-2 min-h-[72px]"
                  value={value}
                  readOnly={!editable}
                  dir="auto"
                  placeholder={t('tw.quiz.answer')}
                  onChange={(e) => setAnswers((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                />
              )}
              {graded && (
                <div className="mt-2 rounded-[12px] bg-surface-2 px-3 py-2 text-sm">
                  {q.kind === 'mcq' ? (
                    <p className={graded.correct ? 'text-success' : 'text-danger'}>{graded.correct ? t('tw.quiz.correct') : t('tw.quiz.incorrect')}</p>
                  ) : (
                    <p className="text-text-3">
                      {t('tw.quiz.model')}
                      {shortMatch && <Check size={13} className="ms-1 inline text-success" />}
                    </p>
                  )}
                  {q.kind !== 'mcq' && <MathMarkdown className="mt-1">{q.answer}</MathMarkdown>}
                  {q.explanation && <MathMarkdown className="mt-1 text-text-2">{q.explanation}</MathMarkdown>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editable ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={submit} disabled={answers.some((a) => !a.trim())} iconStart={<Check size={15} />}>
            {t('tw.quiz.submit')}
          </Button>
          <Button variant="ghost" onClick={() => void resolveTool(p.threadId, p.rowId, p.use.id, { content: 'The student skipped the quiz.' })}>
            {t('tw.quiz.skip')}
          </Button>
        </div>
      ) : p.result ? (
        <Outcome ok={Boolean(past)}>{past ? t('tw.quiz.sent') : t('tw.quiz.skipped')}</Outcome>
      ) : null}
    </Shell>
  );
}

// ── Flashcards ──────────────────────────────────────────────────────────────

function Flashcards(p: WidgetProps) {
  const t = useT();
  const err = useInvalid(p, () => flashcardsInput(p.use.input));
  const input = useMemo(() => (err ? null : flashcardsInput(p.use.input)), [err, p.use.id]);
  const [picked, setPicked] = useState<boolean[]>(() => input?.cards.map(() => true) ?? []);
  const [busy, setBusy] = useState(false);
  if (err || !input) return <InvalidNote />;
  const editable = p.active && !p.result;
  return (
    <Shell icon={<Layers size={15} />} title={input.topic || t('fc.tab')} tone={p.result ? 'muted' : 'default'}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {input.cards.map((c, i) => (
          <li key={i} className={cn('flex gap-3 rounded-[14px] border border-border bg-surface-2 p-3', editable && !picked[i] && 'opacity-55')}>
            {editable && (
              <span className="pt-0.5">
                <Checkbox checked={picked[i] ?? false} onCheckedChange={(v) => setPicked((s) => s.map((x, j) => (j === i ? v : x)))} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <MathMarkdown className="font-medium">{c.front}</MathMarkdown>
              <div className="my-2 h-px bg-border" />
              <MathMarkdown className="text-text-2">{c.back}</MathMarkdown>
            </div>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={busy}
            disabled={!picked.some(Boolean)}
            iconStart={<Check size={15} />}
            onClick={async () => {
              setBusy(true);
              const n = await saveFlashcards(input.cards.filter((_, i) => picked[i]), p.subjectId);
              playUi('create');
              setBusy(false);
              await resolveTool(p.threadId, p.rowId, p.use.id, { content: JSON.stringify({ saved: n }) });
            }}
          >
            {t('tw.cards.save')}
          </Button>
          <Button variant="ghost" onClick={() => void resolveTool(p.threadId, p.rowId, p.use.id, { content: 'The student chose not to save these cards.' })}>
            {t('tw.cards.skip')}
          </Button>
        </div>
      ) : p.result ? (
        <Outcome ok={p.result.content.startsWith('{')}>{p.result.content.startsWith('{') ? t('tw.cards.saved') : t('tw.cards.skipped')}</Outcome>
      ) : null}
    </Shell>
  );
}

