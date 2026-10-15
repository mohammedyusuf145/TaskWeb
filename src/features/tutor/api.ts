/** Calls the tutor Edge Function. The browser never sees the Anthropic key, only the user's session token. */
import { supabase } from '@/lib/supabase';
import { createSseParser, type StreamEvent, type UserBlock, type AssistantBlock } from './protocol';

export class TutorError extends Error {
  constructor(
    public code: string,
    public retryAfter?: number | null,
  ) {
    super(code);
  }
}

const BASE = (import.meta.env.VITE_TUTOR_URL as string | undefined) || (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor` : '');

export const tutorAvailable = () => Boolean(BASE && supabase);

async function headers(): Promise<Record<string, string>> {
  if (!supabase) throw new TutorError('not_signed_in');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new TutorError('not_signed_in');
  return {
    Authorization: `Bearer ${token}`,
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? '',
    'Content-Type': 'application/json',
  };
}

async function failure(res: Response): Promise<TutorError> {
  try {
    const body = (await res.json()) as { error?: string; retry_after?: number | null };
    return new TutorError(body.error ?? `http_${res.status}`, body.retry_after);
  } catch {
    return new TutorError(res.status === 401 ? 'unauthorized' : `http_${res.status}`);
  }
}

export type ApiMessage = { role: 'user'; content: UserBlock[] } | { role: 'assistant'; content: AssistantBlock[] };

/** Streams one assistant turn. Resolves when the stream ends; events arrive through `onEvent`. */
export async function streamChat(messages: ApiMessage[], onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TutorError('offline');
  if (!BASE) throw new TutorError('tutor_not_configured');
  let res: Response;
  try {
    res = await fetch(BASE, { method: 'POST', headers: await headers(), body: JSON.stringify({ mode: 'chat', messages }), signal });
  } catch (e) {
    if (signal?.aborted) throw new TutorError('aborted');
    throw e instanceof TutorError ? e : new TutorError('network');
  }
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const feed = createSseParser();
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const ev of feed(value)) {
        if (ev.event === 'done' || ev.event === 'error') finished = true;
        onEvent(ev);
      }
    }
  } catch {
    if (signal?.aborted) throw new TutorError('aborted');
    throw new TutorError('network');
  }
  if (!finished) throw new TutorError('network');
}

export async function generateFlashcards(req: { lang: 'ar' | 'en'; count: number; subject: string; material: UserBlock[] }): Promise<{ front: string; back: string }[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TutorError('offline');
  if (!BASE) throw new TutorError('tutor_not_configured');
  let res: Response;
  try {
    res = await fetch(BASE, { method: 'POST', headers: await headers(), body: JSON.stringify({ mode: 'flashcards', ...req }) });
  } catch (e) {
    throw e instanceof TutorError ? e : new TutorError('network');
  }
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { cards: { front: string; back: string }[] }).cards;
}
