import { Link } from 'react-router';
import { motion } from 'motion/react';
import { CalendarClock, Flag, MessageSquarePlus, MoreHorizontal, Trash2 } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { relativeDay, formatTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { subjectColor } from '@/design/tokens';
import { softDelete } from '@/lib/db/repo';
import { useAllCards, useSubjects } from '@/lib/db/hooks';
import type { ChatThread } from '@/types/database';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, toast } from '@/components/ui';
import { SubjectDot } from '@/features/subjects/SubjectChip';
import { useFlashcards, useStudyTopics } from '../hooks';
import { isDue } from '../srs';

export function ThreadList({ threads, activeId, onNew, onPick }: { threads: ChatThread[]; activeId?: string; onNew: () => void; onPick?: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const subjects = useSubjects();
  const byId = new Map(subjects?.map((s) => [s.id, s]));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <Button block iconStart={<MessageSquarePlus size={16} />} onClick={onNew}>
          {t('tutor.newChat')}
        </Button>
      </div>
      <h2 className="sr-only">{t('tutor.chats')}</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {threads.map((th) => {
          const subject = th.subject_id ? byId.get(th.subject_id) : undefined;
          const active = th.id === activeId;
          return (
            <li key={th.id} className="group relative">
              <Link
                to={`/tutor/${th.id}`}
                onClick={onPick}
                aria-current={active ? 'page' : undefined}
                className={cn('press relative flex flex-col gap-0.5 rounded-[12px] px-3 py-2.5 pe-9 transition-colors', active ? 'text-text' : 'text-text-2 hover:bg-surface-2 hover:text-text')}
              >
                {active && <motion.span layoutId="thread-pill" aria-hidden className="absolute inset-0 rounded-[12px] border border-border bg-surface-2 shadow-card" />}
                <span className="relative truncate text-base" dir="auto">
                  {th.title || t('tutor.untitled')}
                </span>
                <span className="relative flex items-center gap-1.5 text-xs text-text-3">
                  {subject && <SubjectDot color={subject.color} size={6} />}
                  <span className="truncate">{subject?.name ?? t('tutor.general')}</span>
                  {th.last_message_at && <span className="ms-auto shrink-0">{relativeDay(new Date(th.last_message_at), lang)}</span>}
                </span>
              </Link>
              <div className="absolute end-1.5 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
                <Menu>
                  <MenuTrigger asChild>
                    <button type="button" aria-label={t('tutor.thread.menu')} className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-3 hover:text-text">
                      <MoreHorizontal size={15} />
                    </button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem
                      icon={<Trash2 size={15} />}
                      danger
                      onSelect={() => {
                        void softDelete('chat_threads', [th.id]).then(() => toast(t('tutor.thread.deleted')));
                      }}
                    >
                      {t('tutor.thread.delete')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What the tutor knows about right now: the subject's upcoming work, weak topics and cards due. */
export function ContextPanel({ subjectId, onReview }: { subjectId: string | null; onReview: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const subjects = useSubjects();
  const cards = useAllCards();
  const topics = useStudyTopics(subjectId);
  const flashcards = useFlashcards();
  const subject = subjects?.find((s) => s.id === subjectId);
  const now = new Date();
  const horizon = now.getTime() + 14 * 86_400_000;
  const upcoming = (cards ?? [])
    .filter((c) => c.due_at && !c.completed_at && (!subjectId || c.subject_id === subjectId))
    .filter((c) => new Date(c.due_at!).getTime() <= horizon && new Date(c.due_at!).getTime() >= now.getTime() - 86_400_000)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .slice(0, 6);
  const weak = (topics ?? [])
    .filter((x) => x.attempts > 0)
    .map((x) => ({ ...x, rate: x.correct / x.attempts }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);
  const due = (flashcards ?? []).filter((f) => (!subjectId || f.subject_id === subjectId) && isDue(f, now)).length;

  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <p className="text-xs text-text-3">{t('tutor.panel.subject')}</p>
        <p className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-text">
          {subject && <span className="size-2.5 rounded-full" style={{ background: subjectColor(subject.color) }} />}
          {subject?.name ?? t('tutor.general')}
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-text-2">{t('tutor.panel.upcoming')}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-3">{t('tutor.panel.none')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((c) => {
              const d = new Date(c.due_at!);
              return (
                <li key={c.id} className="rounded-[12px] border border-border bg-surface-2 px-3 py-2">
                  <p className="truncate text-sm text-text" dir="auto">
                    {c.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
                    {c.is_exam ? <Flag size={11} className="text-warning" /> : <CalendarClock size={11} />}
                    {relativeDay(d, lang)}
                    {c.due_has_time && ` ${formatTime(d, lang)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-text-2">{t('tutor.panel.weak')}</h3>
        {weak.length === 0 ? (
          <p className="text-sm text-text-3">{t('tutor.panel.weakNone')}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {weak.map((w) => (
              <li key={w.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-text" dir="auto">
                    {w.topic}
                  </span>
                  <span className="shrink-0 text-xs text-text-3 tabular" dir="ltr">
                    {w.correct}/{w.attempts}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${w.topic}: ${Math.round(w.rate * 100)}%`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, w.rate * 100)}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className={cn('h-full rounded-full', w.rate < 0.5 ? 'bg-danger' : w.rate < 0.75 ? 'bg-warning' : 'bg-success')}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[16px] border border-border bg-surface-2 p-4">
        <h3 className="text-sm font-medium text-text-2">{t('tutor.panel.cards')}</h3>
        <p className="mt-1 font-display text-2xl font-semibold text-text tabular">{t('tutor.panel.due', { n: due })}</p>
        <Button size="sm" variant={due ? 'primary' : 'secondary'} className="mt-3" onClick={onReview}>
          {t('tutor.panel.review')}
        </Button>
      </section>
    </div>
  );
}
