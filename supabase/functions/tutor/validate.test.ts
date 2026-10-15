import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.13';
import { TOOL_NAMES } from './prompt.ts';
import { isStudentTurn, LIMITS, parseChat, parseFlashcards, replayableAssistant, ValidationError, weightedTokens } from './validate.ts';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError) return e.code;
    throw e;
  }
  return 'ok';
};
const user = (text: string) => ({ role: 'user', content: [{ type: 'text', text }] });
const asst = (content: unknown[]) => ({ role: 'assistant', content });
const PNG = 'iVBORw0KGgo=';

Deno.test('accepts a simple conversation and strips unknown fields', () => {
  const r = parseChat(
    {
      mode: 'chat',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }] },
        asst([{ type: 'thinking', thinking: '', signature: 'sig', extra: 1 }, { type: 'text', text: 'hello', citations: [] }]),
        user('explain fractions'),
      ],
    },
    TOOL_NAMES,
  );
  assertEquals(r.messages[0]!.content[0], { type: 'text', text: 'hi' });
  assertEquals(r.messages[1]!.content, [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: 'hello' },
  ]);
});

Deno.test('rejects bad roles, empty and oversized input', () => {
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [] }, TOOL_NAMES)), 'bad_messages');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [asst([{ type: 'text', text: 'x' }])] }, TOOL_NAMES)), 'bad_roles');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('a'), user('b')] }, TOOL_NAMES)), 'bad_roles');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('a'), asst([{ type: 'text', text: 'b' }])] }, TOOL_NAMES)), 'bad_roles');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('x'.repeat(LIMITS.maxTextChars + 1))] }, TOOL_NAMES)), 'text_too_long');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('')] }, TOOL_NAMES)), 'text_too_long');
  const long = Array.from({ length: LIMITS.maxMessages + 1 }, (_, i) => (i % 2 ? asst([{ type: 'text', text: 'a' }]) : user('q')));
  assertEquals(code(() => parseChat({ mode: 'chat', messages: long }, TOOL_NAMES)), 'thread_too_long');
});

Deno.test('rejects server tools, unknown tools and request options smuggled as blocks', () => {
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [{ type: 'server_tool_use', id: 'x', name: 'web_search' }] }] }, TOOL_NAMES)), 'bad_block');
  assertEquals(
    code(() => parseChat({ mode: 'chat', messages: [user('a'), asst([{ type: 'tool_use', id: 't1', name: 'bash', input: {} }]), user('b')] }, TOOL_NAMES)),
    'unknown_tool',
  );
});

Deno.test('media: inline only in the last message, type and size checked', () => {
  const img = (data: string, media_type = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type, data } });
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [img(PNG), { type: 'text', text: 'what is this' }] }] }, TOOL_NAMES)), 'ok');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [img(PNG, 'image/svg+xml')] }] }, TOOL_NAMES)), 'unsupported_image');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [img('not base64!')] }] }, TOOL_NAMES)), 'bad_media');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [img('A'.repeat(LIMITS.maxImageBase64 + 4))] }] }, TOOL_NAMES)), 'image_too_large');
  assertEquals(
    code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [img(PNG)] }, asst([{ type: 'text', text: 'ok' }]), user('next')] }, TOOL_NAMES)),
    'inline_media_in_history',
  );
  const five = Array.from({ length: LIMITS.maxInlineMedia + 1 }, () => img(PNG));
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: five }] }, TOOL_NAMES)), 'too_many_uploads');
  const doc = { type: 'document', source: { type: 'base64', media_type: 'application/x-msdownload', data: PNG } };
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [doc] }] }, TOOL_NAMES)), 'unsupported_document');
  const ref = { type: 'image', source: { type: 'file', file_id: '../../etc' } };
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [{ role: 'user', content: [ref] }] }, TOOL_NAMES)), 'bad_file_id');
});

Deno.test('tool results must answer the previous tool calls, first in the message', () => {
  const call = asst([{ type: 'tool_use', id: 'toolu_1', name: 'get_tasks', input: { range_days: 7, include_done: false } }]);
  const ok = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '[]' }] };
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('plan my week'), call, ok] }, TOOL_NAMES)), 'ok');
  const wrongId = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: '[]' }] };
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('a'), call, wrongId] }, TOOL_NAMES)), 'tool_results_mismatch');
  const textFirst = { role: 'user', content: [{ type: 'text', text: 'hm' }, { type: 'tool_result', tool_use_id: 'toolu_1', content: '[]' }] };
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('a'), call, textFirst] }, TOOL_NAMES)), 'tool_results_mismatch');
  const missing = user('ignoring the tool');
  assertEquals(code(() => parseChat({ mode: 'chat', messages: [user('a'), call, missing] }, TOOL_NAMES)), 'tool_results_mismatch');
  // A deferred quiz result followed by the student's new message is fine.
  const deferred = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'skipped' }, { type: 'text', text: 'new q' }] };
  const r = parseChat({ mode: 'chat', messages: [user('a'), call, deferred] }, TOOL_NAMES);
  assertEquals(isStudentTurn(r.messages[2]!), true);
  assertEquals(isStudentTurn(parseChat({ mode: 'chat', messages: [user('a'), call, ok] }, TOOL_NAMES).messages[2]!), false);
});

Deno.test('bounds tool loops', () => {
  const msgs: unknown[] = [user('go')];
  for (let i = 0; i <= LIMITS.maxToolHops; i++) {
    msgs.push(asst([{ type: 'tool_use', id: `t${i}`, name: 'get_tasks', input: { range_days: 1, include_done: false } }]));
    msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: '[]' }] });
  }
  assertEquals(code(() => parseChat({ mode: 'chat', messages: msgs }, TOOL_NAMES)), 'too_many_tool_calls');
});

Deno.test('flashcards request validation', () => {
  assertEquals(parseFlashcards({ mode: 'flashcards', lang: 'ar', count: 10, subject: 'Science', material: [{ type: 'text', text: 'Photosynthesis…' }] }).count, 10);
  assertEquals(code(() => parseFlashcards({ mode: 'flashcards', count: 100, material: [{ type: 'text', text: 'x' }] })), 'bad_count');
  assertEquals(code(() => parseFlashcards({ mode: 'flashcards', count: 5, material: [] })), 'bad_material');
  assertThrows(() => parseFlashcards({ mode: 'flashcards', count: 5, material: [{ type: 'tool_result', tool_use_id: 'x', content: 'y' }] }), ValidationError);
});

Deno.test('fallback replay drops pre-boundary thinking and tool calls', () => {
  const out = replayableAssistant([
    { type: 'thinking', thinking: '', signature: 'a' },
    { type: 'text', text: 'partial' },
    { type: 'tool_use', id: 't', name: 'get_tasks', input: {} },
    { type: 'fallback', from: { model: 'x' }, to: { model: 'y' } },
    { type: 'thinking', thinking: '', signature: 'b' },
    { type: 'text', text: 'answer' },
  ]);
  assertEquals(out.map((b) => b.type), ['text', 'fallback', 'thinking', 'text']);
  const plain = [{ type: 'thinking' as const, thinking: '', signature: 's' }, { type: 'text' as const, text: 'x' }];
  assertEquals(replayableAssistant(plain), plain);
});

Deno.test('weighted tokens discount cache reads', () => {
  assertEquals(weightedTokens({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 5000 }), 1650);
  assertEquals(weightedTokens({}), 0);
});
