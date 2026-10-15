import { generateNKeysBetween } from 'fractional-indexing';
import { upsert, upsertMany, newId } from '@/lib/db/repo';
import { getUserId } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/db/hooks';
import { addDays, startOfDay } from '@/lib/dates';
import type { Card, Column, Subject } from '@/types/database';
import type { TFunction, Lang } from '@/lib/i18n';

export interface SeedInput {
  lang: Lang;
  subjects: { name: string; color: string; icon: string }[];
  exam?: { subjectIndex: number; title: string; date: Date } | null;
  includeSamples: boolean;
  t: TFunction;
  now?: Date;
}

/** Creates the first workspace: settings, subjects, a "School" board with three columns, and optional cards. */
export async function seedWorkspace(input: SeedInput) {
  const { t, lang } = input;
  const now = input.now ?? new Date();
  const userId = getUserId();

  await upsert('settings', { ...DEFAULT_SETTINGS, id: userId, language: lang });

  const subjectPositions = generateNKeysBetween(null, null, input.subjects.length);
  const subjects = await upsertMany(
    'subjects',
    input.subjects.map((s, i): Partial<Subject> => ({ ...s, id: newId(), position: subjectPositions[i]!, archived_at: null })),
  );

  const board = await upsert('boards', { name: t('board.defaultName'), position: generateNKeysBetween(null, null, 1)[0]!, archived_at: null });

  const colPositions = generateNKeysBetween(null, null, 3);
  const columns = await upsertMany(
    'columns',
    (['todo', 'doing', 'done'] as const).map(
      (kind, i): Partial<Column> => ({
        board_id: board.id,
        name: t(kind === 'todo' ? 'board.col.todo' : kind === 'doing' ? 'board.col.doing' : 'board.col.done'),
        kind,
        color: null,
        position: colPositions[i]!,
      }),
    ),
  );
  const [todo, doing, done] = columns as [Column, Column, Column];

  const cards: Partial<Card>[] = [];
  const at = (days: number, hour: number) => {
    const d = addDays(startOfDay(now), days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const base = (): Partial<Card> => ({
    board_id: board.id,
    description: '',
    notes: '',
    labels: [],
    priority: 'med',
    is_exam: false,
    estimate_min: null,
    repeat_rule: null,
    completed_at: null,
    due_has_time: true,
    is_sample: false,
    reminder_offsets: null,
  });

  if (input.exam) {
    const s = subjects[input.exam.subjectIndex];
    const d = new Date(input.exam.date);
    d.setHours(8, 0, 0, 0);
    cards.push({ ...base(), column_id: todo.id, subject_id: s?.id ?? null, title: input.exam.title, due_at: d.toISOString(), is_exam: true, priority: 'high' });
  }

  if (input.includeSamples && subjects.length) {
    const pick = (i: number) => subjects[i % subjects.length]!.id;
    cards.push(
      { ...base(), column_id: todo.id, subject_id: pick(0), title: t('sample.1'), due_at: at(1, 17), estimate_min: 45, is_sample: true },
      { ...base(), column_id: todo.id, subject_id: pick(2), title: t('sample.2'), due_at: at(2, 16), priority: 'high', estimate_min: 50, is_sample: true },
      { ...base(), column_id: doing.id, subject_id: pick(1), title: t('sample.3'), due_at: null, due_has_time: false, priority: 'low', estimate_min: 25, is_sample: true },
      { ...base(), column_id: done.id, subject_id: pick(3), title: t('sample.4'), due_at: at(-1, 18), completed_at: at(-1, 19), is_sample: true },
    );
  }

  // Positions per column, in insertion order.
  const byColumn = new Map<string, Partial<Card>[]>();
  for (const c of cards) byColumn.set(c.column_id!, [...(byColumn.get(c.column_id!) ?? []), c]);
  for (const list of byColumn.values()) {
    const keys = generateNKeysBetween(null, null, list.length);
    list.forEach((c, i) => (c.position = keys[i]));
  }
  if (cards.length) await upsertMany('cards', cards);

  await upsert('profiles', { id: userId, display_name: '', onboarded_at: new Date().toISOString() });
  return { boardId: board.id };
}
