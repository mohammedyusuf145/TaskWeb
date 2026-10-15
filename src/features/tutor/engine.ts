/**
 * The tutor conversation loop, on the client.
 * - History lives in chat_messages (offline-first, synced) and is append-only, so the API's
 *   prompt cache and preserved thinking stay valid.
 * - A student message is saved only once the server confirms it (with uploads replaced by file ids).
 * - Read-only tools run automatically; tools that change things wait for the student (ToolWidgets).
 */
import { create } from 'zustand';
import { getDb, getUserId } from '@/lib/db';
import { newId, upsert } from '@/lib/db/repo';
import { playUi } from '@/lib/uiSound';
import type { ChatMessage } from '@/types/database';
import { streamChat, TutorError, type ApiMessage } from './api';
import { buildContext } from './context';
import type { AssistantBlock, AttachmentMeta, StoredContent, Style, ToolUse, UserBlock } from './protocol';
import { AUTO_TOOLS, INTERACTIVE_TOOLS, runGetTasks, runRecordTopics } from './tools';
import { ToolInputError } from './toolInput';

export type Activity = { kind: 'thinking' } | { kind: 'writing' } | { kind: 'tool'; name: string } | null;

export interface ThreadRun {
  pending: { text: string; attachments: AttachmentMeta[] } | null;
  partial: Record<number, string>;
  activity: Activity;
  abort: AbortController;
}

interface TutorState {
  runs: Record<string, ThreadRun>;
  errors: Record<string, { code: string; retryAfter?: number | null; text?: string; attachments?: AttachmentMeta[] }>;
}

export const useTutor = create<TutorState>(() => ({ runs: {}, errors: {} }));

const patchRun = (threadId: string, patch: Partial<ThreadRun> | ((r: ThreadRun) => Partial<ThreadRun>)) =>
  useTutor.setState((s) => {
    const r = s.runs[threadId];
    if (!r) return s;
    return { runs: { ...s.runs, [threadId]: { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } } };
  });

export const stored = (m: ChatMessage): StoredContent => (m.content ?? { blocks: [] }) as StoredContent;

export async function loadRows(threadId: string): Promise<ChatMessage[]> {
  const rows = (await getDb().chat_messages.where('thread_id').equals(threadId).toArray()).filter((m) => !m.deleted_at);
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

const toApi = (rows: ChatMessage[]): ApiMessage[] => rows.map((r) => ({ role: r.role, content: stored(r).blocks }) as ApiMessage);
const toolUses = (m: ChatMessage | undefined): ToolUse[] =>
  m && m.role === 'assistant' ? (stored(m).blocks.filter((b) => b.type === 'tool_use') as ToolUse[]) : [];

const MOVED_ON = 'The student moved on without using this. Continue from their new message.';

export async function createThread(subjectId: string | null): Promise<string> {
  const row = await upsert('chat_threads', { subject_id: subjectId, title: '', last_message_at: null });
  return row.id;
}

async function contextFor(threadId: string, style: Style, lang: 'ar' | 'en'): Promise<string> {
  const db = getDb();
  const [thread, settings, subjects] = await Promise.all([db.chat_threads.get(threadId), db.settings.get(getUserId()), db.subjects.toArray()]);
  const live = subjects.filter((s) => !s.deleted_at && !s.archived_at);
  const name = (id: string | null) => (id ? (live.find((s) => s.id === id)?.name ?? null) : null);
  const now = new Date();
  const from = new Date(now.getTime() - 86_400_000).toISOString();
  const to = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const cards = (await db.cards.where('due_at').between(from, to, true, true).toArray()).filter((c) => !c.deleted_at && !c.completed_at);
  const topics = (await db.study_topics.toArray()).filter((t) => !t.deleted_at && t.subject_id === (thread?.subject_id ?? null));
  return buildContext({
    now,
    timezone: settings?.timezone || 'Asia/Bahrain',
    lang,
    style,
    subject: name(thread?.subject_id ?? null),
    subjects: live.map((s) => s.name),
    upcoming: cards.map((c) => ({ title: c.title, due_at: c.due_at!, due_has_time: c.due_has_time, is_exam: c.is_exam, subject: name(c.subject_id) })),
    weak: topics.map((t) => ({ topic: t.topic, correct: t.correct, attempts: t.attempts })),
  });
}

export interface StudentTurn {
  threadId: string;
  text: string;
  attachments: { block: UserBlock; meta: AttachmentMeta }[];
  style: Style;
  lang: 'ar' | 'en';
}

/** Sends what the student wrote (plus any unanswered tool results and the context block). */
export async function sendStudent(turn: StudentTurn): Promise<void> {
  const { threadId } = turn;
  if (useTutor.getState().runs[threadId]) return;
  const rows = await loadRows(threadId);
  const last = rows.at(-1);
  const blocks: UserBlock[] = [];

  // Tool calls the student never answered (a quiz they skipped, a proposal left open) get a result first.
  for (const u of toolUses(last)) {
    const r = stored(last!).meta?.toolResults?.[u.id];
    blocks.push({ type: 'tool_result', tool_use_id: u.id, content: r?.content ?? MOVED_ON, ...(r?.is_error ? { is_error: true } : {}) });
  }
  blocks.push({ type: 'text', text: await contextFor(threadId, turn.style, turn.lang) });
  for (const a of turn.attachments) blocks.push(a.block);
  if (turn.text.trim()) blocks.push({ type: 'text', text: turn.text.trim() });

  const meta: StoredContent['meta'] = { text: turn.text.trim(), attachments: turn.attachments.map((a) => a.meta), style: turn.style };
  let messages: ApiMessage[];
  let rowId: string;
  let rowMeta = meta;
  if (last?.role === 'user') {
    // The previous message never got an answer (error or stop): extend it rather than break alternation.
    const prev = stored(last);
    messages = [...toApi(rows.slice(0, -1)), { role: 'user', content: [...(prev.blocks as UserBlock[]), ...blocks] }];
    rowId = last.id;
    rowMeta = {
      ...prev.meta,
      text: [prev.meta?.text, meta.text].filter(Boolean).join('\n\n'),
      attachments: [...(prev.meta?.attachments ?? []), ...(meta.attachments ?? [])],
      style: turn.style,
    };
  } else {
    messages = [...toApi(rows), { role: 'user', content: blocks }];
    rowId = newId();
  }
  playUi('send');
  await run(threadId, messages, { id: rowId, meta: rowMeta }, { text: turn.text.trim(), attachments: meta.attachments ?? [] });
}

/** Re-sends a thread whose last student message has no answer yet. */
export async function retry(threadId: string): Promise<void> {
  if (useTutor.getState().runs[threadId]) return;
  const rows = await loadRows(threadId);
  const last = rows.at(-1);
  if (!last) return;
  if (last.role === 'user') {
    await run(threadId, toApi(rows), { id: last.id, meta: stored(last).meta ?? {} }, null);
  } else {
    await maybeContinue(threadId, last);
  }
}

export function stop(threadId: string) {
  useTutor.getState().runs[threadId]?.abort.abort();
}

export function clearError(threadId: string) {
  useTutor.setState((s) => {
    const { [threadId]: _, ...rest } = s.errors;
    return { errors: rest };
  });
}

async function run(threadId: string, messages: ApiMessage[], userRow: { id: string; meta: StoredContent['meta'] }, pending: ThreadRun['pending']) {
  const abort = new AbortController();
  clearError(threadId);
  useTutor.setState((s) => ({ runs: { ...s.runs, [threadId]: { pending, partial: {}, activity: { kind: 'thinking' }, abort } } }));
  let userSaved = false;
  let userSave: Promise<void> = Promise.resolve();
  let assistant: ChatMessage | null = null;
  try {
    await streamChat(
      messages,
      (ev) => {
        switch (ev.event) {
          case 'user':
            userSaved = true;
            userSave = saveUser(threadId, userRow.id, ev.data.content, userRow.meta);
            patchRun(threadId, { pending: null });
            break;
          case 'thinking':
            patchRun(threadId, { activity: { kind: 'thinking' } });
            break;
          case 'text':
            patchRun(threadId, (r) => ({ activity: { kind: 'writing' }, partial: { ...r.partial, [ev.data.index]: (r.partial[ev.data.index] ?? '') + ev.data.delta } }));
            break;
          case 'tool_start':
            patchRun(threadId, { activity: { kind: 'tool', name: ev.data.name } });
            break;
          case 'done':
            // Saved after the stream closes (below) so the user row is always written first.
            assistant = {
              id: newId(),
              thread_id: threadId,
              role: 'assistant',
              content: { blocks: ev.data.content, meta: { stop_reason: ev.data.stop_reason, refusal: ev.data.refusal, model: ev.data.model } },
            } as ChatMessage;
            break;
          case 'error':
            throw new TutorError(ev.data.code);
        }
      },
      abort.signal,
    );
  } catch (e) {
    const code = e instanceof TutorError ? e.code : 'network';
    if (code !== 'aborted') {
      playUi('error');
      useTutor.setState((s) => ({
        errors: {
          ...s.errors,
          [threadId]: { code, retryAfter: e instanceof TutorError ? e.retryAfter : null, ...(userSaved ? {} : { text: pending?.text, attachments: pending?.attachments }) },
        },
      }));
    }
  } finally {
    // Keep the run (and its streamed text) on screen until the student's message is stored.
    await userSave.catch(() => {});
    if (assistant && userSaved) {
      const a = assistant as ChatMessage;
      await upsert('chat_messages', { id: a.id, thread_id: threadId, role: 'assistant', content: a.content });
    }
    useTutor.setState((s) => {
      const { [threadId]: _, ...rest } = s.runs;
      return { runs: rest };
    });
  }
  if (assistant && userSaved) {
    const row = (await getDb().chat_messages.get((assistant as ChatMessage).id))!;
    await upsert('chat_threads', { id: threadId, last_message_at: row.created_at });
    playUi('receive');
    await maybeContinue(threadId, row);
  }
}

async function saveUser(threadId: string, id: string, content: UserBlock[], meta: StoredContent['meta']) {
  const row = await upsert('chat_messages', { id, thread_id: threadId, role: 'user', content: { blocks: content, meta } satisfies StoredContent });
  const thread = await getDb().chat_threads.get(threadId);
  const title = thread?.title || (meta?.text || meta?.attachments?.[0]?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  await upsert('chat_threads', { id: threadId, title, last_message_at: row.created_at });
}

/** Runs automatic tools; when every tool call in the turn has a result, sends them back. */
async function maybeContinue(threadId: string, row: ChatMessage) {
  const uses = toolUses(row);
  if (!uses.length) return;
  const content = stored(row);
  if (content.meta?.stop_reason === 'max_tokens' || content.meta?.refusal) return;
  const results = { ...(content.meta?.toolResults ?? {}) };
  const thread = await getDb().chat_threads.get(threadId);
  let changed = false;
  for (const u of uses) {
    if (results[u.id]) continue;
    if (!AUTO_TOOLS.has(u.name) && !INTERACTIVE_TOOLS.has(u.name)) {
      results[u.id] = { content: `Unknown tool "${u.name}".`, is_error: true };
      changed = true;
      continue;
    }
    if (!AUTO_TOOLS.has(u.name)) continue;
    try {
      results[u.id] = { content: u.name === 'get_tasks' ? await runGetTasks(u.input) : await runRecordTopics(u.input, thread?.subject_id ?? null) };
    } catch (e) {
      results[u.id] = { content: e instanceof ToolInputError ? `Invalid input: ${e.message}` : 'The tool failed on the device.', is_error: true };
    }
    changed = true;
  }
  if (changed) await upsert('chat_messages', { id: row.id, content: { ...content, meta: { ...content.meta, toolResults: results } } });
  if (uses.every((u) => results[u.id])) await sendToolResults(threadId, row.id);
}

/** Called by a tool widget once the student has decided (accepted, declined, answered…). */
export async function resolveTool(threadId: string, assistantId: string, toolUseId: string, result: { content: string; is_error?: boolean }) {
  const row = await getDb().chat_messages.get(assistantId);
  if (!row) return;
  const content = stored(row);
  const results = { ...(content.meta?.toolResults ?? {}), [toolUseId]: result };
  const updated = await upsert('chat_messages', { id: row.id, content: { ...content, meta: { ...content.meta, toolResults: results } } });
  await maybeContinue(threadId, updated);
}

async function sendToolResults(threadId: string, assistantId: string) {
  if (useTutor.getState().runs[threadId]) return;
  const rows = await loadRows(threadId);
  const last = rows.at(-1);
  if (!last || last.id !== assistantId) return; // the student already moved on
  const results = stored(last).meta?.toolResults ?? {};
  const blocks: UserBlock[] = toolUses(last).map((u) => ({
    type: 'tool_result',
    tool_use_id: u.id,
    content: results[u.id]!.content,
    ...(results[u.id]!.is_error ? { is_error: true } : {}),
  }));
  await run(threadId, [...toApi(rows), { role: 'user', content: blocks }], { id: newId(), meta: {} }, null);
}

export function assistantText(blocks: AssistantBlock[]): string {
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n\n');
}
