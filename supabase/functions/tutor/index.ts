// Mizan AI tutor. The only place the Anthropic API key is used.
//
// POST {mode:'chat', messages}        -> text/event-stream (see `send` calls below)
// POST {mode:'flashcards', material…} -> JSON {cards}
//
// Security: verifies the Supabase JWT, applies a per-minute limit and daily message/token caps
// (ai_reserve / ai_record in SQL), validates and rebuilds every content block, owns the system
// prompt and tool list, and never logs request bodies, tokens or keys.

import Anthropic, { toFile } from 'npm:@anthropic-ai/sdk@0.128.0';
import { adminClient, getUser } from '../_shared/auth.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { FLASHCARD_PROMPT, FLASHCARD_SCHEMA, SYSTEM_PROMPT, TOOL_NAMES, TOOLS } from './prompt.ts';
import {
  type AssistantBlock,
  fileIds,
  isStudentTurn,
  type MediaSource,
  type Msg,
  parseChat,
  parseFlashcards,
  replayableAssistant,
  type UserBlock,
  ValidationError,
  weightedTokens,
} from './validate.ts';

const env = (k: string, d: string) => (Deno.env.get(k) ?? '').trim() || d;
const envInt = (k: string, d: number) => {
  const n = Number.parseInt(env(k, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = env('TUTOR_MODEL', 'claude-sonnet-5-5');
const MODEL_LIGHT = env('TUTOR_MODEL_LIGHT', 'claude-haiku-5-5');
const EFFORT = env('TUTOR_EFFORT', 'medium') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const PER_MINUTE = envInt('TUTOR_PER_MINUTE', 12);
const DAILY_MESSAGES = envInt('TUTOR_DAILY_MESSAGE_CAP', 60);
const DAILY_TOKENS = envInt('TUTOR_DAILY_TOKEN_CAP', 150_000);
const MAX_OUTPUT = envInt('TUTOR_MAX_OUTPUT_TOKENS', 12_000);
/** Server-side refusal fallback ("default" form). Not offered on Haiku models. */
const FALLBACK = env('TUTOR_FALLBACK', 'default') !== 'off' && !MODEL.startsWith('claude-haiku');
const MAX_BODY = 24 * 1024 * 1024;

const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY, maxRetries: 2, timeout: 5 * 60_000 }) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return error(req, 405, 'method_not_allowed');
  if (!anthropic) return error(req, 503, 'tutor_not_configured');

  const auth = await getUser(req);
  if (!auth) return error(req, 401, 'unauthorized');
  const userId = auth.user.id;

  const len = Number(req.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY) return error(req, 413, 'request_too_large');
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return error(req, 413, 'request_too_large');
    body = JSON.parse(text);
  } catch {
    return error(req, 400, 'bad_json');
  }

  const mode = (body as { mode?: unknown } | null)?.mode;
  try {
    if (mode === 'flashcards') return await flashcards(req, userId, body);
    return await chat(req, userId, body);
  } catch (e) {
    if (e instanceof ValidationError) return error(req, 400, e.code);
    if (e instanceof LimitError) return json(req, 429, { error: e.reason, retry_after: e.retryAfter ?? null });
    const code = apiErrorCode(e);
    logError('request failed', userId, e);
    return error(req, code === 'bad_request' ? 400 : 502, code);
  }
});

// ── Chat (streaming) ────────────────────────────────────────────────────────

async function chat(req: Request, userId: string, body: unknown): Promise<Response> {
  const parsed = parseChat(body, TOOL_NAMES);
  const messages = parsed.messages;
  const last = messages[messages.length - 1] as Extract<Msg, { role: 'user' }>;
  const admin = adminClient();

  await reserve(admin, userId, isStudentTurn(last));

  // Anything referenced by file id must have been uploaded by this user.
  const referenced = fileIds(messages.flatMap((m) => (m.role === 'user' ? m.content : [])));
  if (referenced.length) {
    const { data, error: qErr } = await admin.from('tutor_files').select('file_id').eq('user_id', userId).in('file_id', referenced);
    if (qErr) throw qErr;
    if ((data ?? []).length !== referenced.length) throw new ValidationError('unknown_file');
  }

  // New photos/PDFs go to the Files API once; history then carries only the file id.
  last.content = await Promise.all(last.content.map((b) => uploadInline(admin, userId, b)));

  const encoder = new TextEncoder();
  // Client disconnects arrive as the stream's cancel(); that aborts the upstream call too.
  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          closed = true;
        }
      }, 15_000);

      const usage: Record<string, number | null> = {};
      try {
        send('user', { content: last.content });

        const s = anthropic!.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_OUTPUT,
            system: [{ type: 'text', text: SYSTEM_PROMPT }],
            cache_control: { type: 'ephemeral' },
            thinking: { type: 'adaptive', display: 'omitted' },
            output_config: { effort: EFFORT },
            tools: TOOLS.map((t) => ({ ...t, strict: true, eager_input_streaming: true })) as unknown as Anthropic.Beta.BetaToolUnion[],
            tool_choice: { type: 'auto' },
            messages: messages as unknown as Anthropic.Beta.BetaMessageParam[],
            ...(FALLBACK ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { signal: abort.signal },
        );

        for await (const ev of s) {
          if (ev.type === 'message_start') {
            Object.assign(usage, ev.message.usage);
            send('meta', { model: ev.message.model });
          } else if (ev.type === 'message_delta') {
            for (const [k, v] of Object.entries(ev.usage)) if (typeof v === 'number') usage[k] = v;
          } else if (ev.type === 'content_block_start') {
            const b = ev.content_block;
            if (b.type === 'tool_use') send('tool_start', { index: ev.index, name: b.name });
            else if (b.type === 'thinking' || b.type === 'redacted_thinking') send('thinking', { index: ev.index });
            else if (b.type === 'fallback') send('fallback', { index: ev.index });
          } else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            send('text', { index: ev.index, delta: ev.delta.text });
          }
        }

        const msg = await s.finalMessage();
        Object.assign(usage, msg.usage);
        let content = replayableAssistant(msg.content.filter(keepBlock) as unknown as AssistantBlock[]);
        let stop: string | null = msg.stop_reason;

        if (stop === 'refusal') {
          // Discard partial output; keep the thread valid with a short placeholder turn.
          content = [{ type: 'text', text: '[declined]' }];
        } else if (stop === 'max_tokens' && content.some((b) => b.type === 'tool_use')) {
          // A cut-off tool call may parse as valid partial input: never run it.
          content = content.filter((b) => b.type !== 'tool_use');
          stop = 'max_tokens';
        }
        if (!content.some((b) => b.type === 'text' || b.type === 'tool_use')) content.push({ type: 'text', text: '…' });

        send('done', {
          content,
          stop_reason: stop,
          refusal: stop === 'refusal' ? { category: msg.stop_details?.category ?? null } : null,
          model: msg.model,
        });
      } catch (e) {
        if (abort.signal.aborted) {
          send('error', { code: 'aborted' });
        } else {
          logError('stream failed', userId, e);
          send('error', { code: apiErrorCode(e) });
        }
      } finally {
        clearInterval(ping);
        const spent = weightedTokens(usage);
        if (spent > 0) {
          const { error: recErr } = await admin.rpc('ai_record', { p_user: userId, p_tokens: spent, p_tz: await timezone(admin, userId) });
          if (recErr) console.error('ai_record failed', userId, recErr.message);
        }
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Only the block types the app stores and replays. */
function keepBlock(b: { type: string }): boolean {
  return ['text', 'thinking', 'redacted_thinking', 'tool_use', 'fallback'].includes(b.type);
}

async function uploadInline(admin: ReturnType<typeof adminClient>, userId: string, b: UserBlock): Promise<UserBlock> {
  if ((b.type !== 'image' && b.type !== 'document') || b.source.type !== 'base64') return b;
  const src = b.source as Extract<MediaSource, { type: 'base64' }>;
  const bytes = Uint8Array.from(atob(src.data), (c) => c.charCodeAt(0));
  const ext = src.media_type.split('/')[1] ?? 'bin';
  try {
    const file = await anthropic!.files.upload({ file: await toFile(bytes, `upload.${ext}`, { type: src.media_type }) });
    const { error: insErr } = await admin.from('tutor_files').insert({ file_id: file.id, user_id: userId, mime: src.media_type });
    if (insErr) throw insErr;
    const source = { type: 'file' as const, file_id: file.id };
    return b.type === 'image' ? { type: 'image', source } : { ...b, source };
  } catch (e) {
    logError('upload failed', userId, e);
    throw new ValidationError('upload_failed');
  }
}

// ── Flashcards from material (light model, structured output) ─────────────

async function flashcards(req: Request, userId: string, body: unknown): Promise<Response> {
  const p = parseFlashcards(body);
  const admin = adminClient();
  await reserve(admin, userId, true);

  const lang = p.lang === 'ar' ? 'Arabic' : 'English';
  const msg = await anthropic!.beta.messages.create({
    model: MODEL_LIGHT,
    max_tokens: 8_000,
    system: FLASHCARD_PROMPT,
    thinking: { type: 'adaptive', display: 'omitted' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: FLASHCARD_SCHEMA as unknown as Record<string, unknown> } },
    messages: [
      {
        role: 'user',
        content: [
          ...(p.material as unknown as Anthropic.Beta.BetaContentBlockParam[]),
          { type: 'text', text: `Write up to ${p.count} flashcards in ${lang}${p.subject ? ` for the subject "${p.subject}"` : ''} from the material above.` },
        ],
      },
    ],
  });

  const spent = weightedTokens(msg.usage);
  if (spent > 0) await admin.rpc('ai_record', { p_user: userId, p_tokens: spent, p_tz: await timezone(admin, userId) });

  if (msg.stop_reason === 'refusal') return error(req, 422, 'declined');
  const text = msg.content.find((b) => b.type === 'text');
  let cards: { front: string; back: string }[] = [];
  try {
    const out = JSON.parse(text && text.type === 'text' ? text.text : '{}') as { cards?: unknown };
    cards = (Array.isArray(out.cards) ? out.cards : [])
      .filter((c): c is { front: string; back: string } => typeof c?.front === 'string' && typeof c?.back === 'string')
      .map((c) => ({ front: c.front.trim().slice(0, 2000), back: c.back.trim().slice(0, 4000) }))
      .filter((c) => c.front && c.back)
      .slice(0, p.count);
  } catch {
    return error(req, 502, 'bad_output');
  }
  return json(req, 200, { cards });
}

// ── Limits ──────────────────────────────────────────────────────────────────

class LimitError extends Error {
  constructor(public reason: string, public retryAfter?: number) {
    super(reason);
  }
}

const tzCache = new Map<string, string>();
async function timezone(admin: ReturnType<typeof adminClient>, userId: string): Promise<string> {
  const hit = tzCache.get(userId);
  if (hit) return hit;
  const { data } = await admin.from('settings').select('timezone').eq('user_id', userId).maybeSingle();
  const tz = (data?.timezone as string | undefined) || 'Asia/Bahrain';
  if (tzCache.size > 500) tzCache.clear();
  tzCache.set(userId, tz);
  return tz;
}

async function reserve(admin: ReturnType<typeof adminClient>, userId: string, isMessage: boolean): Promise<void> {
  const { data, error: rpcErr } = await admin.rpc('ai_reserve', {
    p_user: userId,
    p_is_message: isMessage,
    p_per_minute: PER_MINUTE,
    p_daily_messages: DAILY_MESSAGES,
    p_daily_tokens: DAILY_TOKENS,
    p_tz: await timezone(admin, userId),
  });
  if (rpcErr) throw rpcErr;
  const r = data as { ok: boolean; reason?: string; retry_after?: number };
  if (!r?.ok) throw new LimitError(r?.reason ?? 'rate_limited', r?.retry_after);
}

// ── Errors ──────────────────────────────────────────────────────────────────

function apiErrorCode(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return 'busy';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'tutor_not_configured';
  if (e instanceof Anthropic.BadRequestError) return 'bad_request';
  if (e instanceof Anthropic.APIConnectionError) return 'network';
  if (e instanceof Anthropic.APIError) return e.status === 529 || e.status === 503 ? 'overloaded' : 'upstream_error';
  return 'server_error';
}

/** Logs status and error type only: never bodies, headers, tokens or keys. */
function logError(what: string, userId: string, e: unknown): void {
  if (e instanceof Anthropic.APIError) {
    const type = (e.error as { error?: { type?: string } } | undefined)?.error?.type ?? 'unknown';
    console.error(what, userId, `anthropic ${e.status ?? '-'} ${type}`, e.requestID ?? '');
  } else {
    console.error(what, userId, e instanceof Error ? e.name : 'unknown');
  }
}
