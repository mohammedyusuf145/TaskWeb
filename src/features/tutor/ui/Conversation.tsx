import { useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, FileText, RotateCcw, ScissorsLineDashed, ShieldAlert } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/locales/en';
import { cn } from '@/lib/cn';
import type { ChatMessage } from '@/types/database';
import { Button } from '@/components/ui';
import { LogoMark } from '@/app/shell/Logo';
import { MathMarkdown } from '@/components/content/MathMarkdown';
import { clearError, retry, stored, useTutor, type Activity } from '../engine';
import type { AssistantBlock, AttachmentMeta, ToolUse, UserBlock } from '../protocol';
import { ToolWidget } from './ToolWidgets';
import { INTERACTIVE_TOOLS } from '../tools';

export function errorKey(code: string): MessageKey {
  const map: Record<string, MessageKey> = {
    offline: 'tutor.err.offline',
    network: 'tutor.err.network',
    rate_limited: 'tutor.err.rate_limited',
    daily_messages: 'tutor.err.daily_messages',
    daily_tokens: 'tutor.err.daily_tokens',
    thread_too_long: 'tutor.err.thread_too_long',
    upload_failed: 'tutor.err.upload_failed',
    image_too_large: 'tutor.err.too_large',
    document_too_large: 'tutor.err.too_large',
    too_large: 'tutor.err.too_large',
    request_too_large: 'tutor.err.too_large',
    unsupported: 'tutor.err.unsupported',
    unsupported_image: 'tutor.err.unsupported',
    unsupported_document: 'tutor.err.unsupported',
    empty: 'tutor.err.empty',
    too_many_uploads: 'tutor.err.too_many_uploads',
    tutor_not_configured: 'tutor.err.tutor_not_configured',
    busy: 'tutor.err.busy',
    overloaded: 'tutor.err.busy',
    unauthorized: 'tutor.err.unauthorized',
    not_signed_in: 'tutor.err.unauthorized',
    declined: 'tutor.err.declined',
  };
  return map[code] ?? 'tutor.err.generic';
}

/** The message list. Assistant turns read like a document; the student's turns sit in bubbles. */
export function Conversation({
  threadId,
  messages,
  subjectId,
  onQuick,
}: {
  threadId: string;
  messages: ChatMessage[];
  subjectId: string | null;
  onQuick: (prompt: string) => void;
}) {
  const t = useT();
  const run = useTutor((s) => s.runs[threadId]);
  const error = useTutor((s) => s.errors[threadId]);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Results for every tool call: from the stored meta, or from the following tool_result message.
  const results = new Map<string, { content: string; is_error?: boolean }>();
  for (const m of messages) {
    const c = stored(m);
    for (const [id, r] of Object.entries(c.meta?.toolResults ?? {})) results.set(id, r);
    if (m.role === 'user')
      for (const b of c.blocks as UserBlock[]) if (b.type === 'tool_result') results.set(b.tool_use_id, { content: b.content, is_error: b.is_error });
  }
  const lastId = messages.at(-1)?.id;
  let prevAssistant = false;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && stored(m).blocks.some((b) => b.type === 'text'));

  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  const partialLen = run ? Object.values(run.partial).join('').length : 0;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length, partialLen, run?.pending, Boolean(error)]);
  useEffect(() => {
    pinned.current = true;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [threadId]);

  return (
    <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pt-6 pb-10 md:px-8">
        {messages.map((m) => {
          const c = stored(m);
          if (m.role === 'user') {
            if (!c.meta?.text && !c.meta?.attachments?.length) return null; // tool results only
            prevAssistant = false;
            return <UserBubble key={m.id} text={c.meta?.text ?? ''} attachments={c.meta?.attachments ?? []} />;
          }
          const visible =
            c.meta?.refusal ||
            c.meta?.stop_reason === 'max_tokens' ||
            c.blocks.some((b) => (b.type === 'text' && b.text.trim() && b.text !== '…') || (b.type === 'tool_use' && INTERACTIVE_TOOLS.has(b.name)));
          if (!visible) return null; // a behind-the-scenes step (reading the board, saving results)
          const continued = prevAssistant;
          prevAssistant = true;
          return (
            <AssistantTurn key={m.id} continued={continued}>
              {c.meta?.refusal ? (
                <Notice icon={<ShieldAlert size={15} />}>{t('tutor.declined')}</Notice>
              ) : (
                (c.blocks as AssistantBlock[]).map((b, i) =>
                  b.type === 'text' ? (
                    b.text.trim() && b.text !== '…' ? <MathMarkdown key={i}>{b.text}</MathMarkdown> : null
                  ) : b.type === 'tool_use' ? (
                    <ToolWidget
                      key={b.id}
                      threadId={threadId}
                      rowId={m.id}
                      use={b as ToolUse}
                      result={results.get(b.id) ?? null}
                      active={m.id === lastId && !run}
                      subjectId={subjectId}
                    />
                  ) : null,
                )
              )}
              {c.meta?.stop_reason === 'max_tokens' && <Notice icon={<ScissorsLineDashed size={15} />}>{t('tutor.cutoff')}</Notice>}
              {m.id === lastAssistant?.id && m.id === lastId && !run && !c.meta?.refusal && !c.blocks.some((b) => b.type === 'tool_use') && (
                <QuickActions onQuick={onQuick} />
              )}
            </AssistantTurn>
          );
        })}

        {run?.pending && <UserBubble text={run.pending.text} attachments={run.pending.attachments} sending />}
        {run && (
          <AssistantTurn live continued={prevAssistant && !run.pending}>
            {Object.keys(run.partial).length > 0 && (
              <MathMarkdown className="stream-caret">{Object.entries(run.partial).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v).join('\n\n')}</MathMarkdown>
            )}
            <ActivityLine activity={run.activity} />
          </AssistantTurn>
        )}

        <AnimatePresence>
          {error && !run && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex flex-col gap-3 rounded-[16px] border border-danger/30 bg-danger-soft px-4 py-3 sm:flex-row sm:items-center"
            >
              <p className="flex flex-1 items-start gap-2 text-base text-text">
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
                {t(errorKey(error.code))}
              </p>
              {!['daily_messages', 'daily_tokens', 'thread_too_long', 'tutor_not_configured'].includes(error.code) && (
                <Button
                  size="sm"
                  iconStart={<RotateCcw size={14} />}
                  onClick={() => {
                    clearError(threadId);
                    void retry(threadId);
                  }}
                >
                  {t('tutor.retry')}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AssistantTurn({ children, live, continued }: { children: React.ReactNode; live?: boolean; continued?: boolean }) {
  return (
    <motion.article
      initial={live ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3', continued && '-mt-3')}
    >
      <span className="mt-0.5 w-[26px] shrink-0">{!continued && <LogoMark size={26} />}</span>
      <div className="min-w-0 flex-1 text-[15px]">{children}</div>
    </motion.article>
  );
}

function UserBubble({ text, attachments, sending }: { text: string; attachments: AttachmentMeta[]; sending?: boolean }) {
  return (
    <motion.div
      initial={sending ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-end gap-2 self-end ps-10"
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {attachments.map((a, i) =>
            a.thumb ? (
              <img key={i} src={a.thumb} alt={a.name} className="h-24 w-auto max-w-[180px] rounded-[14px] border border-border object-cover" />
            ) : (
              <span key={i} className="inline-flex h-10 max-w-[220px] items-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 text-sm text-text-2">
                <FileText size={15} className="shrink-0" />
                <span className="truncate" dir="auto">
                  {a.name}
                </span>
              </span>
            ),
          )}
        </div>
      )}
      {text && (
        <div
          className={cn('max-w-full rounded-[18px] rounded-ee-[6px] bg-surface-3 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-text', sending && 'opacity-80')}
          dir="auto"
        >
          {text}
        </div>
      )}
    </motion.div>
  );
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="my-2 flex items-start gap-2 rounded-[12px] bg-surface-1 px-3 py-2 text-sm text-text-2">
      <span className="mt-0.5 shrink-0 text-text-3">{icon}</span>
      {children}
    </p>
  );
}

function ActivityLine({ activity }: { activity: Activity }) {
  const t = useT();
  if (!activity || activity.kind === 'writing') return null;
  const key = (activity.kind === 'tool' ? `tutor.act.${activity.name}` : 'tutor.act.thinking') as MessageKey;
  return (
    <p role="status" className="mt-1 inline-flex items-center gap-2 text-sm text-text-3">
      <span aria-hidden className="pearl-bead size-3 rounded-full" />
      {t(key)}
    </p>
  );
}

function QuickActions({ onQuick }: { onQuick: (prompt: string) => void }) {
  const t = useT();
  const items: [MessageKey, MessageKey][] = [
    ['tutor.again', 'tutor.again.prompt'],
    ['tutor.solution', 'tutor.solution.prompt'],
    ['tutor.quizMe', 'tutor.quizMe.prompt'],
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 flex flex-wrap gap-2">
      {items.map(([label, prompt]) => (
        <button
          key={label}
          type="button"
          onClick={() => onQuick(t(prompt))}
          className="press h-8 rounded-full border border-border bg-surface-1 px-3 text-sm text-text-2 transition-colors hover:border-border-strong hover:text-text"
        >
          {t(label)}
        </button>
      ))}
    </motion.div>
  );
}
