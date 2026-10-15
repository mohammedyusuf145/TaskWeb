// Request validation for the tutor function. Pure: no Deno APIs, so it is unit-tested directly.
// Every block is rebuilt from an allow-list of fields, so a client can't smuggle in
// cache_control, server tools, citations or other request options.

export const LIMITS = {
  maxMessages: 120,
  maxBlocksPerMessage: 24,
  maxTextChars: 24_000,
  /** Characters of non-media JSON across the whole history. */
  maxHistoryChars: 600_000,
  maxToolResultChars: 24_000,
  /** New uploads per request (inline base64, only allowed in the last message). */
  maxInlineMedia: 4,
  maxImageBase64: 5_000_000, // ≈ 3.7 MB decoded
  maxPdfBase64: 14_000_000, // ≈ 10 MB decoded
  maxPlainDocChars: 120_000,
  maxMediaTotal: 30,
  /** Tool round-trips allowed after one real student message. */
  maxToolHops: 8,
} as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const STYLES = ['simple', 'steps', 'analogy', 'exam'] as const;

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export type MediaSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'file'; file_id: string }
  | { type: 'text'; media_type: 'text/plain'; data: string };

export type UserBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: MediaSource }
  | { type: 'document'; source: MediaSource; title?: string }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
  | { type: 'tool_use'; id: string; name: string; input: Json }
  | { type: 'fallback'; from: Json; to: Json; trigger?: Json };

export type Msg = { role: 'user'; content: UserBlock[] } | { role: 'assistant'; content: AssistantBlock[] };

export interface ChatRequest {
  mode: 'chat';
  messages: Msg[];
}

export interface FlashcardsRequest {
  mode: 'flashcards';
  lang: 'ar' | 'en';
  count: number;
  subject: string;
  material: UserBlock[];
}

export class ValidationError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const fail = (code: string): never => {
  throw new ValidationError(code);
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, code: string, min = 0): string =>
  typeof v === 'string' && v.length <= max && v.length >= min ? v : fail(code);
const FILE_ID = /^file_[A-Za-z0-9_-]{4,120}$/;
const TOOL_ID = /^[A-Za-z0-9_-]{1,128}$/;
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

function source(v: unknown, kind: 'image' | 'document', inlineAllowed: boolean): MediaSource {
  if (!isObj(v)) return fail('bad_source');
  if (v.type === 'file') return { type: 'file', file_id: FILE_ID.test(String(v.file_id)) ? String(v.file_id) : fail('bad_file_id') };
  if (v.type === 'text' && kind === 'document') {
    return { type: 'text', media_type: 'text/plain', data: str(v.data, LIMITS.maxPlainDocChars, 'document_too_large', 1) };
  }
  if (v.type !== 'base64') return fail('bad_source');
  if (!inlineAllowed) return fail('inline_media_in_history');
  const media = String(v.media_type);
  const data = typeof v.data === 'string' ? v.data : fail('bad_media');
  if (kind === 'image') {
    if (!(IMAGE_TYPES as readonly string[]).includes(media)) fail('unsupported_image');
    if (data.length > LIMITS.maxImageBase64) fail('image_too_large');
  } else {
    if (media !== 'application/pdf') fail('unsupported_document');
    if (data.length > LIMITS.maxPdfBase64) fail('document_too_large');
  }
  if (data.length === 0 || data.length % 4 !== 0 || !B64.test(data)) fail('bad_media');
  return { type: 'base64', media_type: media, data };
}

function toolResultContent(v: unknown): string {
  if (typeof v === 'string') return str(v, LIMITS.maxToolResultChars, 'tool_result_too_large');
  if (Array.isArray(v)) {
    const text = v.map((b) => (isObj(b) && b.type === 'text' && typeof b.text === 'string' ? b.text : fail('bad_tool_result'))).join('\n');
    return str(text, LIMITS.maxToolResultChars, 'tool_result_too_large');
  }
  return fail('bad_tool_result');
}

export function userBlock(v: unknown, inlineAllowed: boolean): UserBlock {
  if (!isObj(v)) return fail('bad_block');
  switch (v.type) {
    case 'text':
      return { type: 'text', text: str(v.text, LIMITS.maxTextChars, 'text_too_long', 1) };
    case 'image':
      return { type: 'image', source: source(v.source, 'image', inlineAllowed) };
    case 'document': {
      const out: UserBlock = { type: 'document', source: source(v.source, 'document', inlineAllowed) };
      if (v.title !== undefined) out.title = str(v.title, 200, 'bad_title');
      return out;
    }
    case 'tool_result': {
      const out: UserBlock = {
        type: 'tool_result',
        tool_use_id: TOOL_ID.test(String(v.tool_use_id)) ? String(v.tool_use_id) : fail('bad_tool_id'),
        content: toolResultContent(v.content),
      };
      if (v.is_error === true) out.is_error = true;
      return out;
    }
    default:
      return fail('bad_block');
  }
}

function assistantBlock(v: unknown, toolNames: ReadonlySet<string>): AssistantBlock {
  if (!isObj(v)) return fail('bad_block');
  switch (v.type) {
    case 'text':
      // Assistant text can legitimately be empty after a mid-stream refusal; allow it.
      return { type: 'text', text: str(v.text, 200_000, 'text_too_long') };
    case 'thinking':
      return { type: 'thinking', thinking: str(v.thinking, 200_000, 'bad_thinking'), signature: str(v.signature, 100_000, 'bad_thinking', 1) };
    case 'redacted_thinking':
      return { type: 'redacted_thinking', data: str(v.data, 200_000, 'bad_thinking', 1) };
    case 'tool_use': {
      const name = String(v.name);
      if (!toolNames.has(name)) fail('unknown_tool');
      if (!isObj(v.input)) fail('bad_tool_input');
      return { type: 'tool_use', id: TOOL_ID.test(String(v.id)) ? String(v.id) : fail('bad_tool_id'), name, input: v.input as Json };
    }
    case 'fallback': {
      if (!isObj(v.from) || !isObj(v.to)) fail('bad_block');
      const out: AssistantBlock = { type: 'fallback', from: v.from as Json, to: v.to as Json };
      if (v.trigger !== undefined) out.trigger = v.trigger as Json;
      return out;
    }
    default:
      return fail('bad_block');
  }
}

const isMedia = (b: UserBlock) => b.type === 'image' || b.type === 'document';
const isInline = (b: UserBlock) => isMedia(b) && (b as { source: MediaSource }).source.type === 'base64';

/** A turn the student actually wrote (not just tool results). Counts toward the daily message cap. */
export function isStudentTurn(m: Msg): boolean {
  return m.role === 'user' && m.content.some((b) => b.type !== 'tool_result');
}

export function parseChat(body: unknown, toolNames: ReadonlySet<string>): ChatRequest {
  if (!isObj(body) || body.mode !== 'chat') return fail('bad_request');
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) return fail('bad_messages');
  if (raw.length > LIMITS.maxMessages) fail('thread_too_long');

  const messages: Msg[] = raw.map((m, i) => {
    if (!isObj(m) || !Array.isArray(m.content) || m.content.length === 0) return fail('bad_messages');
    if (m.content.length > LIMITS.maxBlocksPerMessage) fail('too_many_blocks');
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (m.role !== expected) fail('bad_roles');
    const last = i === raw.length - 1;
    return m.role === 'user'
      ? { role: 'user', content: m.content.map((b) => userBlock(b, last)) }
      : { role: 'assistant', content: m.content.map((b) => assistantBlock(b, toolNames)) };
  });
  if (messages[messages.length - 1]!.role !== 'user') fail('bad_roles');

  // Tool results must answer exactly the tool calls of the assistant turn before them, and come first.
  for (let i = 1; i < messages.length; i += 2) {
    const asst = messages[i]!;
    const next = messages[i + 1];
    const calls = asst.content.filter((b) => b.type === 'tool_use').map((b) => (b as { id: string }).id);
    if (!next) continue;
    const results = next.content.filter((b) => b.type === 'tool_result').map((b) => (b as { tool_use_id: string }).tool_use_id);
    const leading = next.content.slice(0, results.length).every((b) => b.type === 'tool_result');
    if (!leading || results.length !== calls.length || !calls.every((id) => results.includes(id))) fail('tool_results_mismatch');
  }

  let media = 0;
  let inline = 0;
  let chars = 0;
  for (const m of messages) {
    for (const b of m.content as (UserBlock | AssistantBlock)[]) {
      if (m.role === 'user' && isMedia(b as UserBlock)) {
        media++;
        if (isInline(b as UserBlock)) inline++;
        else chars += JSON.stringify(b).length;
      } else chars += JSON.stringify(b).length;
    }
  }
  if (inline > LIMITS.maxInlineMedia) fail('too_many_uploads');
  if (media > LIMITS.maxMediaTotal) fail('too_many_files');
  if (chars > LIMITS.maxHistoryChars) fail('thread_too_long');

  // Bound tool loops: count trailing tool-only user turns.
  let hops = 0;
  for (let i = messages.length - 1; i >= 0 && !isStudentTurn(messages[i]!); i -= 2) hops++;
  if (hops > LIMITS.maxToolHops) fail('too_many_tool_calls');

  return { mode: 'chat', messages };
}

export function parseFlashcards(body: unknown): FlashcardsRequest {
  if (!isObj(body) || body.mode !== 'flashcards') return fail('bad_request');
  const lang = body.lang === 'ar' ? 'ar' : 'en';
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 3 || count > 30) fail('bad_count');
  const subject = str(body.subject ?? '', 80, 'bad_subject');
  if (!Array.isArray(body.material) || body.material.length === 0 || body.material.length > 6) return fail('bad_material');
  const material = body.material.map((b) => userBlock(b, true));
  if (material.some((b) => b.type === 'tool_result')) fail('bad_material');
  if (material.filter(isInline).length > LIMITS.maxInlineMedia) fail('too_many_uploads');
  return { mode: 'flashcards', lang, count, subject, material };
}

/** Every Files API id the request references, so the server can confirm they belong to the caller. */
export function fileIds(blocks: UserBlock[]): string[] {
  const ids = new Set<string>();
  for (const b of blocks) if (isMedia(b) && (b as { source: MediaSource }).source.type === 'file') ids.add((b as { source: { file_id: string } }).source.file_id);
  return [...ids];
}

/**
 * Prepares an assistant turn for storage and replay. After a mid-output fallback, thinking,
 * redacted_thinking and tool_use blocks that appear before the last fallback block must not be echoed back.
 */
export function replayableAssistant(content: AssistantBlock[]): AssistantBlock[] {
  let lastFallback = -1;
  content.forEach((b, i) => {
    if (b.type === 'fallback') lastFallback = i;
  });
  return content.filter((b, i) => i > lastFallback || b.type === 'text' || b.type === 'fallback');
}

/** Weighted tokens for the daily cap: cache reads cost a tenth of fresh input. */
export function weightedTokens(u: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number {
  return (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + Math.ceil((u.cache_read_input_tokens ?? 0) / 10);
}
