import { assertEquals } from 'jsr:@std/assert@1';
import { buildMessage } from './messages.ts';

const base = {
  card_id: 'c1',
  board_id: 'b1',
  title: 'Unit 3 test',
  is_exam: true,
  due_at: '2026-10-15T14:00:00Z',
  due_has_time: true,
  offset_min: 60,
  subject_name: 'Mathematics',
  language: 'en',
  timezone: 'Asia/Bahrain',
};

Deno.test('english, timed, exam', () => {
  const m = buildMessage(base);
  assertEquals(m.title, 'Exam: Unit 3 test');
  assertEquals(m.body, 'Due in 1 h · 17:00 · Mathematics');
  assertEquals(m.url, '/board/b1?card=c1');
});

Deno.test('arabic, date-only, tomorrow', () => {
  const m = buildMessage({ ...base, language: 'ar', is_exam: false, due_has_time: false, offset_min: 1440, subject_name: null });
  assertEquals(m.title, 'Unit 3 test');
  assertEquals(m.body, 'مستحقة غدًا');
  assertEquals(m.dir, 'rtl');
});
