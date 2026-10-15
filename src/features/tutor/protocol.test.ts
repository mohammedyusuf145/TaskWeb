import { describe, expect, it } from 'vitest';
import { createSseParser } from './protocol';

describe('sse parser', () => {
  it('parses events split across chunks and skips pings and unknown events', () => {
    const feed = createSseParser();
    expect(feed('event: text\ndata: {"index":1,"del')).toEqual([]);
    expect(feed('ta":"Hi"}\n\n: ping\n\nevent: nope\ndata: {}\n\nevent: done\r\ndata: {"content":[],"stop_reason":"end_turn","refusal":null,"model":"m"}\r\n\r\n')).toEqual([
      { event: 'text', data: { index: 1, delta: 'Hi' } },
      { event: 'done', data: { content: [], stop_reason: 'end_turn', refusal: null, model: 'm' } },
    ]);
  });

  it('keeps Arabic text and newlines inside JSON intact', () => {
    const feed = createSseParser();
    const evs = feed(`event: text\ndata: ${JSON.stringify({ index: 0, delta: 'المشتقة\n$x^2$' })}\n\n`);
    expect(evs[0]).toEqual({ event: 'text', data: { index: 0, delta: 'المشتقة\n$x^2$' } });
  });
});
