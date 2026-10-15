import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { BookOpenCheck, CalendarRange, GraduationCap, Layers, Lightbulb, LogIn, MessagesSquare, PanelRight } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import type { MessageKey } from '@/locales/en';
import { useAuth, signOut } from '@/lib/auth';
import { upsert } from '@/lib/db/repo';
import { useSubjects } from '@/lib/db/hooks';
import { Button, EmptyState, IconButton, Segmented, Select, Sheet, Skeleton } from '@/components/ui';
import { PageHeader } from '@/app/shell/PageHeader';
import { useThread, useThreads, useMessages } from '@/features/tutor/hooks';
import { createThread, sendStudent, stop, useTutor } from '@/features/tutor/engine';
import type { Style } from '@/features/tutor/protocol';
import { tutorAvailable } from '@/features/tutor/api';
import { Conversation } from '@/features/tutor/ui/Conversation';
import { Composer, type Attached } from '@/features/tutor/ui/Composer';
import { ContextPanel, ThreadList } from '@/features/tutor/ui/Side';
import { FlashcardsView } from '@/features/tutor/ui/Flashcards';

const STYLE_KEY = 'mizan.tutorStyle';
const readStyle = (): Style => {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    return v === 'simple' || v === 'steps' || v === 'analogy' || v === 'exam' ? v : 'steps';
  } catch {
    return 'steps';
  }
};

export function TutorPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const { threadId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'cards' ? 'cards' : 'chat';
  const mode = useAuth((s) => s.mode);
  const online = mode === 'cloud' && tutorAvailable();

  const threads = useThreads();
  const thread = useThread(threadId);
  const messages = useMessages(threadId);
  const subjects = useSubjects();
  const run = useTutor((s) => (threadId ? s.runs[threadId] : undefined));
  const error = useTutor((s) => (threadId ? s.errors[threadId] : undefined));

  const [style, setStyleState] = useState<Style>(readStyle);
  const [newSubject, setNewSubject] = useState<string>('');
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [reviewNow, setReviewNow] = useState(0);

  const setStyle = (s: Style) => {
    setStyleState(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const setTab = (v: 'chat' | 'cards') => setParams((p) => (v === 'cards' ? p.set('tab', 'cards') : p.delete('tab'), p), { replace: true });

  // A deleted or unknown thread falls back to a fresh chat.
  useEffect(() => {
    if (threadId && thread === null) navigate('/tutor', { replace: true });
  }, [thread, threadId]);

  // Put back what the student typed if the message never reached the tutor.
  useEffect(() => {
    if (error?.text) setDraft({ text: error.text, n: Date.now() });
  }, [error]);

  const subjectId = thread ? thread.subject_id : newSubject || null;

  async function send(text: string, files: Attached[]) {
    let id = threadId;
    if (!id) {
      id = await createThread(newSubject || null);
      navigate(`/tutor/${id}`);
    }
    await sendStudent({ threadId: id, text, attachments: files, style, lang });
  }

  const suggestions: { icon: React.ReactNode; label: MessageKey; prompt: MessageKey; style?: Style }[] = [
    { icon: <Lightbulb size={16} />, label: 'tutor.suggest.explain', prompt: 'tutor.prompt.explain', style: 'steps' },
    { icon: <BookOpenCheck size={16} />, label: 'tutor.suggest.quiz', prompt: 'tutor.prompt.quiz' },
    { icon: <CalendarRange size={16} />, label: 'tutor.suggest.plan', prompt: 'tutor.prompt.plan', style: 'exam' },
    { icon: <Layers size={16} />, label: 'tutor.suggest.cards', prompt: 'tutor.prompt.cards' },
  ];

  const subjectSelect = (
    <div className="w-[170px]">
      <Select
        aria-label={t('tutor.panel.subject')}
        value={subjectId ?? ''}
        onChange={(e) => {
          if (thread) void upsert('chat_threads', { id: thread.id, subject_id: e.target.value || null });
          else setNewSubject(e.target.value);
        }}
        className="!h-9 !rounded-full !text-sm"
      >
        <option value="">{t('tutor.general')}</option>
        {subjects?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('nav.tutor')}
        actions={
          <Segmented
            label={t('nav.tutor')}
            value={tab}
            onValueChange={setTab}
            className="max-sm:[&_button]:px-2.5"
            options={[
              { value: 'chat', label: <span className="max-sm:sr-only">{t('chat.tab')}</span>, icon: <MessagesSquare size={15} /> },
              { value: 'cards', label: <span className="max-sm:sr-only">{t('fc.tab')}</span>, icon: <Layers size={15} /> },
            ]}
          />
        }
      />

      {tab === 'cards' ? (
        <FlashcardsView canGenerate={online} reviewNow={reviewNow} onReviewHandled={() => setReviewNow(0)} />
      ) : !online ? (
        <div className="px-4 py-10 md:px-8">
          <EmptyState
            icon={<GraduationCap size={20} />}
            title={t('tutor.signin.title')}
            body={t('tutor.signin.body')}
            action={
              <>
                {mode === 'demo' && tutorAvailable() && (
                  <Button variant="primary" iconStart={<LogIn size={16} className="flip-rtl" />} onClick={() => void signOut()}>
                    {t('tutor.signin.action')}
                  </Button>
                )}
                <Button variant="secondary" iconStart={<Layers size={16} />} onClick={() => setTab('cards')}>
                  {t('fc.tab')}
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div className="flex h-[calc(100dvh-56px-var(--bottombar-h)-env(safe-area-inset-bottom))] min-h-0 md:h-[calc(100dvh-8px-69px)]">
          <aside className="hidden w-[272px] shrink-0 border-e border-border lg:block">
            {threads ? <ThreadList threads={threads} activeId={threadId} onNew={() => navigate('/tutor')} /> : <Skeleton className="m-3 h-10" />}
          </aside>

          <section aria-label={t('nav.tutor')} className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:px-6">
              <IconButton className="lg:hidden" label={t('tutor.chats')} icon={<MessagesSquare size={18} />} onClick={() => setThreadsOpen(true)} />
              <p className="min-w-0 flex-1 truncate text-base text-text-2" dir="auto">
                {thread?.title || t('tutor.newChat')}
              </p>
              {subjectSelect}
              <IconButton className="xl:hidden" label={t('tutor.panel')} icon={<PanelRight size={18} className="flip-rtl" />} onClick={() => setContextOpen(true)} />
            </div>

            {threadId && messages && messages.length > 0 ? (
              <Conversation threadId={threadId} messages={messages} subjectId={subjectId} onQuick={(p) => void send(p, [])} />
            ) : threadId && run ? (
              <Conversation threadId={threadId} messages={[]} subjectId={subjectId} onQuick={() => {}} />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto flex max-w-[640px] flex-col items-start px-5 pt-[8vh] pb-8"
                >
                  <span aria-hidden className="pearl mb-6 size-14 rounded-full shadow-lift" />
                  <h2 className="font-display text-3xl font-semibold text-text text-balance">{t('tutor.empty.title')}</h2>
                  <p className="mt-3 max-w-[520px] text-md text-text-2">{t('tutor.empty.body')}</p>
                  <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={s.label}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        onClick={() => {
                          if (s.style) setStyle(s.style);
                          setDraft({ text: t(s.prompt), n: Date.now() });
                        }}
                        className="lift press flex items-center gap-3 rounded-[16px] border border-border bg-surface-1 px-4 py-3.5 text-start text-base text-text-2 hover:text-text"
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-text">{s.icon}</span>
                        {t(s.label)}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            <Composer
              busy={Boolean(run)}
              style={style}
              onStyle={setStyle}
              onSend={(text, files) => void send(text, files)}
              onStop={() => threadId && stop(threadId)}
              draft={draft}
              onDraftConsumed={() => setDraft(null)}
            />
          </section>

          <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-s border-border bg-surface-1/40 xl:block">
            <ContextPanel subjectId={subjectId} onReview={() => (setTab('cards'), setReviewNow(Date.now()))} />
          </aside>
        </div>
      )}

      <Sheet open={threadsOpen} onOpenChange={setThreadsOpen} title={t('tutor.chats')} side="end" width={340}>
        {threads && (
          <ThreadList
            threads={threads}
            activeId={threadId}
            onPick={() => setThreadsOpen(false)}
            onNew={() => {
              setThreadsOpen(false);
              navigate('/tutor');
            }}
          />
        )}
      </Sheet>
      <Sheet open={contextOpen} onOpenChange={setContextOpen} title={t('tutor.panel')} side="end" width={340}>
        <ContextPanel
          subjectId={subjectId}
          onReview={() => {
            setContextOpen(false);
            setTab('cards');
            setReviewNow(Date.now());
          }}
        />
      </Sheet>
    </>
  );
}
