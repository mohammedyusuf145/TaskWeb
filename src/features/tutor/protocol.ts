/** Wire types shared by the tutor client and its stored messages (mirrors the Edge Function). */

export type MediaSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'file'; file_id: string }
  | { type: 'text'; media_type: 'text/plain'; data: string };

export type UserBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: MediaSource }
  | { type: 'document'; source: MediaSource; title?: string }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export type ToolUse = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
  | ToolUse
  | { type: 'fallback'; from: unknown; to: unknown; trigger?: unknown };

export type Style = 'simple' | 'steps' | 'analogy' | 'exam';

export interface AttachmentMeta {
  kind: 'image' | 'pdf' | 'text';
  name: string;
  /** Small JPEG data URL for images, so history can show what was sent. */
  thumb?: string;
}

/** What a chat_messages row's `content` holds. */
export interface StoredContent {
  blocks: (UserBlock | AssistantBlock)[];
  meta?: {
    /** User turns: what the student typed (without the context block) and what they attached. */
    text?: string;
    attachments?: AttachmentMeta[];
    style?: Style;
    /** Assistant turns. */
    stop_reason?: string | null;
    refusal?: { category: string | null } | null;
    model?: string;
    /** Results for this turn's tool calls, gathered until all are in (auto tools + the student's decisions). */
    toolResults?: Record<string, { content: string; is_error?: boolean }>;
  };
}

export type StreamEvent =
  | { event: 'user'; data: { content: UserBlock[] } }
  | { event: 'meta'; data: { model: string } }
  | { event: 'thinking'; data: { index: number } }
  | { event: 'fallback'; data: { index: number } }
  | { event: 'text'; data: { index: number; delta: string } }
  | { event: 'tool_start'; data: { index: number; name: string } }
  | {
      event: 'done';
      data: { content: AssistantBlock[]; stop_reason: string | null; refusal: { category: string | null } | null; model: string };
    }
  | { event: 'error'; data: { code: string } };

/**
 * Incremental SSE parser: feed it decoded chunks, it returns complete events.
 * Ignores comments (": ping") and unknown event names.
 */
export function createSseParser() {
  let buf = '';
  const known = new Set(['user', 'meta', 'thinking', 'fallback', 'text', 'tool_start', 'done', 'error']);
  return (chunk: string): StreamEvent[] => {
    buf += chunk.replace(/\r\n/g, '\n');
    const out: StreamEvent[] = [];
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith(':')) continue;
        const i = line.indexOf(':');
        const field = i === -1 ? line : line.slice(0, i);
        const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (!known.has(event) || data.length === 0) continue;
      try {
        out.push({ event, data: JSON.parse(data.join('\n')) } as StreamEvent);
      } catch {
        /* malformed event: skip */
      }
    }
    return out;
  };
}

export const CONTEXT_OPEN = '<context>';
export const isContextBlock = (b: UserBlock | AssistantBlock) => b.type === 'text' && b.text.startsWith(CONTEXT_OPEN);
