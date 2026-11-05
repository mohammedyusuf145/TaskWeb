import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { dueFrom, normalizeAnswer, proposeCardsInput, quizInput, ToolInputError, topicResultsInput, updateCardInput } from './toolInput';

describe('context block', () => {
  it('summarises the day, style, upcoming work and weak topics', () => {
    const text = buildContext({
      now: new Date(2026, 9, 11, 16, 40),
      timezone: 'Asia/Bahrain',
      lang: 'ar',
      style: 'steps',
      subject: 'Mathematics',
      subjects: ['Mathematics', 'Science'],
      upcoming: [
        { title: 'Ch.3 <test>\nnow', due_at: new Date(2026, 9, 13, 23, 59).toISOString(), due_has_time: false, is_exam: true, subject: 'Mathematics' },
        { title: 'Lab report', due_at: new Date(2026, 9, 12, 8, 0).toISOString(), due_has_time: true, is_exam: false, subject: null },
      ],
      weak: [
        { topic: 'Fractions', correct: 1, attempts: 4 },
        { topic: 'Angles', correct: 4, attempts: 4 },
        { topic: 'Once', correct: 0, attempts: 1 },
      ],
    });
    expect(text).toBe(
      [
        '<context>',
        'now: Sunday 2026-10-11 16:40 (Asia/Bahrain)',
        'lang: ar',
        'style: steps',
        'subject: Mathematics',
        "student's subjects: Mathematics, Science",
        'upcoming (use get_tasks for more):',
        '- 2026-10-12 08:00 Lab report',
        '- 2026-10-13 EXAM [Mathematics] Ch.3 test now',
        'weak topics in this subject: Fractions (1/4)',
        '</context>',
      ].join('\n'),
    );
  });
});

describe('tool input validation', () => {
  it('accepts well-formed card proposals and rejects bad dates', () => {
    const ok = proposeCardsInput({
      reason: 'Plan',
      cards: [{ title: ' Revise ch.1 ', notes: null, due_date: '2026-10-14', due_time: '17:30', priority: 'high', subject: 'Math', is_exam: false }],
    });
    expect(ok.cards[0]).toMatchObject({ title: 'Revise ch.1', due_time: '17:30', priority: 'high' });
    expect(() => proposeCardsInput({ reason: '', cards: [{ title: 'x', due_date: '14/10/2026', priority: 'low' }] })).toThrow(ToolInputError);
    expect(() => proposeCardsInput({ reason: '', cards: [{ title: 'x', due_date: null, due_time: '10:00', priority: 'low' }] })).toThrow(/time without a date/);
    expect(() => proposeCardsInput({ reason: '', cards: [] })).toThrow(ToolInputError);
  });

  it('update_card needs at least one change; "none" clears and "keep" keeps', () => {
    expect(() => updateCardInput({ card_id: 'c1', reason: '', title: null, notes: null, due_date: null, due_time: null, priority: 'keep', done: null })).toThrow(/no changes/);
    const u = updateCardInput({ card_id: 'c1', reason: '', title: null, notes: null, due_date: 'none', due_time: null, priority: 'keep', done: true });
    expect(u).toMatchObject({ due_date: 'none', priority: null, done: true });
  });

  it('quiz: mcq answers must match a choice exactly', () => {
    const q = { kind: 'mcq', prompt: '2+2?', choices: ['3', '4'], answer: '5', explanation: '', topic: 'Addition' };
    expect(() => quizInput({ title: 'Q', questions: [q] })).toThrow(/match one of its choices/);
    expect(quizInput({ title: 'Q', questions: [{ ...q, answer: '4' }] }).questions[0]!.answer).toBe('4');
  });

  it('topic results stay consistent', () => {
    expect(() => topicResultsInput({ results: [{ topic: 'x', correct: 3, total: 2 }] })).toThrow(ToolInputError);
    expect(topicResultsInput({ results: [{ topic: 'x', correct: 1, total: 2 }] })).toEqual([{ topic: 'x', correct: 1, total: 2 }]);
  });

  it('dates: date-only cards are due at 23:59 local', () => {
    const d = dueFrom('2026-10-14', null);
    expect(d.due_has_time).toBe(false);
    expect(new Date(d.due_at).getHours()).toBe(23);
    expect(new Date(dueFrom('2026-10-14', '07:05').due_at).getMinutes()).toBe(5);
  });

  it('normalises Arabic answers', () => {
    expect(normalizeAnswer(' إِجابة   ٤٢ ')).toBe(normalizeAnswer('اجابة 42'));
    expect(normalizeAnswer('X = 3')).toBe('x = 3');
  });
});
