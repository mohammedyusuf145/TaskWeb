import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase, getDb, useDbStore } from '@/lib/db';
import type { MizanDB } from '@/lib/db/schema';
import { addChecklistItem, createBoard, createCard, createColumn, deleteColumn, duplicateCard, moveCard, moveColumn, restore, setCardDone } from './ops';
import { byPosition } from './position';

const USER = '11111111-1111-1111-1111-111111111111';
let db: MizanDB;

beforeEach(() => {
  db = connectDatabase(`ops-${Math.random()}`);
  useDbStore.setState({ userId: USER });
});
afterEach(async () => {
  await db.delete();
  disconnectDatabase();
});

async function setup() {
  const board = await createBoard('School');
  const cols = (await getDb().columns.where('board_id').equals(board.id).toArray()).sort(byPosition);
  const [todo, doing, done] = cols as [(typeof cols)[0], (typeof cols)[0], (typeof cols)[0]];
  return { board, todo, doing, done };
}
const list = async (columnId: string) =>
  (await getDb().cards.where('column_id').equals(columnId).toArray()).filter((c) => !c.deleted_at).sort(byPosition).map((c) => c.title);

describe('board ops', () => {
  it('a new board gets To do / In progress / Done', async () => {
    const { todo, doing, done } = await setup();
    expect([todo.kind, doing.kind, done.kind]).toEqual(['todo', 'doing', 'done']);
  });

  it('cards append to the end and can be reordered between neighbours', async () => {
    const { board, todo } = await setup();
    const a = await createCard({ board_id: board.id, column_id: todo.id, title: 'A' });
    await createCard({ board_id: board.id, column_id: todo.id, title: 'B' });
    const c = await createCard({ board_id: board.id, column_id: todo.id, title: 'C' });
    expect(await list(todo.id)).toEqual(['A', 'B', 'C']);
    await moveCard(c.id, todo.id, a.id, (await getDb().cards.toArray()).find((x) => x.title === 'B')!.id);
    expect(await list(todo.id)).toEqual(['A', 'C', 'B']);
  });

  it('moving into Done completes the card; moving out reopens it', async () => {
    const { board, todo, done } = await setup();
    const card = await createCard({ board_id: board.id, column_id: todo.id, title: 'Essay' });
    await moveCard(card.id, done.id, null, null);
    expect((await getDb().cards.get(card.id))?.completed_at).toBeTruthy();
    await moveCard(card.id, todo.id, null, null);
    expect((await getDb().cards.get(card.id))?.completed_at).toBeNull();
  });

  it('completing a repeating card schedules the next one with a fresh checklist', async () => {
    const { board, todo } = await setup();
    const due = new Date(Date.now() + 3600_000);
    const card = await createCard({
      board_id: board.id,
      column_id: todo.id,
      title: 'Vocab',
      due_at: due.toISOString(),
      repeat_rule: { freq: 'daily', interval: 1 },
    });
    const item = await addChecklistItem(card.id, 'List 1');
    await getDb().checklist_items.update(item.id, { done: true });
    await setCardDone((await getDb().cards.get(card.id))!, true);

    const all = (await getDb().cards.toArray()).filter((c) => c.title === 'Vocab');
    expect(all).toHaveLength(2);
    const next = all.find((c) => c.id !== card.id)!;
    expect(next.column_id).toBe(todo.id);
    expect(next.completed_at).toBeNull();
    expect(Date.parse(next.due_at!) - due.getTime()).toBe(86_400_000);
    expect((await getDb().cards.get(card.id))?.repeat_rule).toBeNull();
    const items = await getDb().checklist_items.where('card_id').equals(next.id).toArray();
    expect(items.map((i) => [i.text, i.done])).toEqual([['List 1', false]]);
  });

  it('duplicate places the copy right after the original', async () => {
    const { board, todo } = await setup();
    const a = await createCard({ board_id: board.id, column_id: todo.id, title: 'A' });
    await createCard({ board_id: board.id, column_id: todo.id, title: 'B' });
    await duplicateCard(a);
    expect(await list(todo.id)).toEqual(['A', 'A', 'B']);
  });

  it('deleting a column removes its cards and can be undone', async () => {
    const { board, doing } = await setup();
    await createCard({ board_id: board.id, column_id: doing.id, title: 'X' });
    const removed = await deleteColumn(doing.id);
    expect(await list(doing.id)).toEqual([]);
    await restore('columns', [removed.column]);
    await restore('cards', removed.cards);
    expect(await list(doing.id)).toEqual(['X']);
  });

  it('columns reorder', async () => {
    const { board, done } = await setup();
    await createColumn(board.id, 'Revision');
    await moveColumn(board.id, done.id, 0);
    const names = (await getDb().columns.where('board_id').equals(board.id).toArray()).sort(byPosition).map((c) => c.name);
    expect(names[0]).toBe(done.name);
    expect(names.at(-1)).toBe('Revision');
  });
});
