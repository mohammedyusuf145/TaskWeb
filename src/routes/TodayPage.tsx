import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui';
import { demoDataCount, dismissDemoImport, importDemoData } from '@/features/settings/demoImport';
import { Link, useNavigate } from 'react-router';
import * as m from 'motion/react-m';
import { BookOpen, Check, Flag, GraduationCap, Layers, Plus, Timer } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { formatDate, formatDateLong, formatTime, relativeDay, startOfDay } from '@/lib/dates';
import { useAllCards, useFocusSessions, useProfile, useSubjects } from '@/lib/db/hooks';
import { cn } from '@/lib/cn';
import { subjectColor } from '@/design/tokens';
import type { Card } from '@/types/database';
import { Button, ProgressRing } from '@/components/ui';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';
import { useSettings } from '@/features/settings/settings';
import { setCardDone } from '@/features/boards/ops';
import { useQuickAdd } from '@/features/quick-add/store';
import { useTimerPrefs } from '@/features/timer/prefs';
import { formatDuration } from '@/features/stats/aggregate';
import { useFlashcards } from '@/features/tutor/hooks';
import { isDue } from '@/features/tutor/srs';
import { useBooks, updateBook } from '@/features/books/data';
import { progress } from '@/features/books/logic';
import { BookCover } from '@/features/books/BookCover';
import { dayPart, dayPlan } from '@/features/today/plan';

/** The day in one place: what's due, the next exam, focus time, cards to review and the current book. */
export function TodayPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const settings = useSettings();
  const profile = useProfile();
  const cards = useAllCards();
  const subjects = useSubjects();
  const today = useMemo(() => startOfDay(new Date()), []);
  const sessions = useFocusSessions(today);
  const prefs = useTimerPrefs();
  const flashcards = useFlashcards();
  const books = useBooks();
  const now = new Date();

  const plan = useMemo(() => dayPlan(cards ?? [], new Date()), [cards]);
  const minutes = (sessions ?? []).reduce((a, s) => a + s.focused_sec / 60, 0);
  const due = (flashcards ?? []).filter((f) => isDue(f, now)).length;
  const reading = (books ?? []).filter((b) => b.status === 'reading').sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const subjectOf = (id: string | null) => subjects?.find((s) => s.id === id);

  const greet = t(`today.${dayPart(now)}`);
  const name = profile?.display_name?.trim();
  const secondary = settings.calendar_show_secondary ? formatDateLong(now, lang, settings.calendar_primary === 'gregorian' ? 'hijri' : 'gregorian') : null;
  const summary = [
    plan.today.length ? t('today.summary.tasks', { n: plan.today.length }) : t('today.summary.clear'),
    plan.overdue.length ? t('today.summary.overdue', { n: plan.overdue.length }) : null,
  ].filter(Boolean);

  const examWhen = plan.examInDays === null ? '' : plan.examInDays === 0 ? t('today.exam.today') : plan.examInDays === 1 ? t('today.exam.tomorrow') : t('today.exam.in', { n: plan.examInDays });

  return (
    <>
      <PageHeader title={t('nav.today')} meta={formatDateLong(now, lang, settings.calendar_primary)} />
      <PageBody>
        <DemoImportBanner />
        <m.section initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
          <h2 className="font-display text-3xl text-text">{name ? t('today.greetName', { greet, name }) : greet}</h2>
          <p className="mt-2 text-md text-text-2">
            {summary.join(' · ')}
            {secondary && <span className="text-text-3"> · {secondary}</span>}
          </p>
        </m.section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Plan */}
          <section aria-labelledby="today-plan" className="rounded-[12px] border border-border bg-surface-1">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h3 id="today-plan" className="text-lg font-semibold text-text">
                {t('today.plan')}
              </h3>
              <Button size="sm" variant="ghost" iconStart={<Plus size={15} />} onClick={() => useQuickAdd.getState().show({ dueAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).toISOString(), dueHasTime: false })}>
                {t('today.add')}
              </Button>
            </header>
            {plan.overdue.length + plan.today.length + plan.doneToday.length === 0 ? (
              <p className="px-5 py-8 text-base text-text-3">{t('today.empty')}</p>
            ) : (
              <div className="py-2">
                <Group title={t('today.overdue')} tone="danger" cards={plan.overdue} subjectOf={subjectOf} lang={lang} />
                <Group title={t('today.dueToday')} cards={plan.today} subjectOf={subjectOf} lang={lang} />
                <Group title={t('today.doneToday')} cards={plan.doneToday} subjectOf={subjectOf} lang={lang} done />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-6">
            {/* Next exam */}
            <Panel title={t('today.exam')} icon={<Flag size={15} />}>
              {plan.nextExam ? (
                <div className="flex items-start gap-4">
                  <div className="flex min-w-[72px] flex-col items-center rounded-[10px] border border-border bg-surface-2 px-3 py-2">
                    <span className="font-display text-3xl text-text tabular">{plan.examInDays}</span>
                    <span className="text-xs text-text-3">{examWhen}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-text" dir="auto">
                      {plan.nextExam.title}
                    </p>
                    <p className="mt-0.5 text-sm text-text-3">
                      {relativeDay(new Date(plan.nextExam.due_at!), lang)}
                      {plan.nextExam.due_has_time && ` · ${formatTime(new Date(plan.nextExam.due_at!), lang)}`}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      iconStart={<GraduationCap size={14} />}
                      onClick={() =>
                        navigate(`/tutor?ask=${encodeURIComponent(t('today.exam.prompt', { title: plan.nextExam!.title, date: formatDate(new Date(plan.nextExam!.due_at!), lang) }))}`)
                      }
                    >
                      {t('today.exam.plan')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-base text-text-3">{t('today.exam.none')}</p>
              )}
            </Panel>

            {/* Focus + flashcards side by side on wide screens */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Panel title={t('today.focus')} icon={<Timer size={15} />}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={Math.min(1, minutes / prefs.dailyGoalMin)} size={56} stroke={5}>
                    <span className="text-xs font-medium text-text tabular">{Math.min(100, Math.round((minutes / prefs.dailyGoalMin) * 100))}%</span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="text-base text-text tabular">
                      {formatDuration(minutes, lang)} / {formatDuration(prefs.dailyGoalMin, lang)}
                    </p>
                    <Link to="/focus" className="mt-1 inline-block text-sm font-medium text-accent-text hover:underline">
                      {t('today.focus.start')}
                    </Link>
                  </div>
                </div>
              </Panel>
              <Panel title={t('today.cards')} icon={<Layers size={15} />}>
                {due ? <p className="font-display text-2xl text-text tabular">{t('today.cards.due', { n: due })}</p> : <p className="text-base text-text-3">{t('today.cards.none')}</p>}
                {due > 0 && (
                  <Link to="/cards?review=1" className="mt-1 inline-block text-sm font-medium text-accent-text hover:underline">
                    {t('today.cards.review')}
                  </Link>
                )}
              </Panel>
            </div>

            {/* Reading */}
            <Panel title={t('today.reading')} icon={<BookOpen size={15} />}>
              {reading ? (
                <div className="flex gap-4">
                  <Link to={`/books/${reading.id}`} className="w-14 shrink-0">
                    <BookCover title={reading.title} author={reading.author} url={reading.cover_url} mode={reading.cover_mode} color={reading.cover_color} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/books/${reading.id}`} className="block truncate font-reading text-md font-semibold text-text hover:underline" dir="auto">
                      {reading.title}
                    </Link>
                    <p className="truncate text-sm text-text-3" dir="auto">
                      {reading.author}
                    </p>
                    {progress(reading) !== null && (
                      <div className="mt-2 flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)]" style={{ width: `${progress(reading)! * 100}%` }} />
                        </span>
                        <span className="text-xs text-text-3 tabular" dir="ltr">
                          {reading.current_page}/{reading.pages}
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 -ms-3"
                      onClick={() => void updateBook(reading.id, { current_page: reading.pages ? Math.min(reading.pages, reading.current_page + 10) : reading.current_page + 10 })}
                    >
                      {t('today.reading.add')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-base text-text-3">{t('today.reading.none')}</p>
                  <Link to="/books" className="mt-1 inline-block text-sm font-medium text-accent-text hover:underline">
                    {t('today.reading.shelf')}
                  </Link>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-border bg-surface-1 px-5 py-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-2">
        <span className="text-text-3">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Group({
  title,
  cards,
  subjectOf,
  lang,
  tone,
  done,
}: {
  title: string;
  cards: Card[];
  subjectOf: (id: string | null) => { name: string; color: string } | undefined;
  lang: 'ar' | 'en';
  tone?: 'danger';
  done?: boolean;
}) {
  const t = useT();
  if (!cards.length) return null;
  return (
    <div className="px-2 pt-2 pb-1">
      <p className={cn('px-3 pb-1 text-xs font-medium', tone === 'danger' ? 'text-danger' : 'text-text-3')}>{title}</p>
      <ul className="divide-y divide-border">
        {cards.map((c) => {
          const s = subjectOf(c.subject_id);
          const d = new Date(c.due_at!);
          return (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                aria-label={done ? t('today.markOpen', { title: c.title }) : t('today.markDone', { title: c.title })}
                onClick={() => void setCardDone(c, !done)}
                className={cn(
                  'press inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  done ? 'border-accent bg-accent text-accent-ink' : 'border-border-strong hover:border-accent',
                )}
              >
                {done && <Check size={12} strokeWidth={3} />}
              </button>
              <Link to={`/board/${c.board_id}?card=${c.id}`} className={cn('min-w-0 flex-1 truncate text-base hover:underline', done ? 'text-text-3' : 'text-text')} dir="auto">
                {c.title}
              </Link>
              {c.is_exam && <Flag size={13} className="shrink-0 text-warning" aria-label={t('board.exam')} />}
              {s && (
                <span className="hidden shrink-0 items-center gap-1.5 text-sm text-text-3 sm:inline-flex">
                  <span className="size-1.5 rounded-full" style={{ background: subjectColor(s.color) }} />
                  {s.name}
                </span>
              )}
              <span className="shrink-0 text-sm text-text-3 tabular">{c.due_has_time ? formatTime(d, lang) : tone === 'danger' ? relativeDay(d, lang) : ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shown once after signing in when this browser still holds demo-mode data. */
function DemoImportBanner() {
  const t = useT();
  const mode = useAuth((s) => s.mode);
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mode === 'cloud') void demoDataCount().then(setN).catch(() => setN(0));
  }, [mode]);
  if (!n) return null;
  return (
    <section role="region" aria-label={t('demo.import.title')} className="mb-6 flex flex-col gap-3 rounded-[12px] border border-accent/40 bg-accent-soft px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-text">{t('demo.import.title')}</p>
        <p className="mt-0.5 text-sm text-text-2">{t('demo.import.body', { n })}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => (dismissDemoImport(), setN(0))}>
          {t('demo.import.dismiss')}
        </Button>
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const done = await importDemoData();
            setBusy(false);
            setN(0);
            toast(t('demo.import.done', { n: done }), { tone: 'success' });
          }}
        >
          {t('demo.import.run')}
        </Button>
      </div>
    </section>
  );
}
