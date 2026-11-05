/**
 * All board/column/card/checklist mutations. Each one writes locally first (instant, offline-safe)
 * and queues the change for sync. Components never call upsert directly for these tables.
 */
import { getDb } from '@/lib/db';
import { newId, softDelete, upsert, upsertMany } from '@/lib/db/repo';
import { getT } from '@/lib/i18n';
import { playUi } from '@/lib/uiSound';
import type { Board, Card, ChecklistItem, Column } from '@/types/database';
import { nextOccurrence } from '@/features/cards/repeat';
import { byPosition, positionAt, positionBetween, positionsAfter } from './position';

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

async function boardsSorted(): Promise<Board[]> {
  return live(await getDb().boards.toArray()).sort(byPosition);
}
async function columnsOf(boardId: string): Promise<Column[]> {
  return live(await getDb().columns.where('board_id').equals(boardId).toArray()).sort(byPosition);
}
async function cardsIn(columnId: string): Promise<Card[]> {
  return live(await getDb().cards.where('column_id').equals(columnId).toArray()).sort(byPosition);
}

// ── Boards ──────────────────────────────────────────────────────────────────

export async function createBoard(name: string): Promise<Board> {
  const t = getT();
  const boards = await boardsSorted();
  const board = await upsert('boards', { name, position: positionAt(boards, boards.length), archived_at: null });
  const keys = positionsAfter(null, 3);
  await upsertMany('columns', [
    { board_id: board.id, name: t('board.col.todo'), kind: 'todo', color: null, position: keys[0]! },
    { board_id: board.id, name: t('board.col.doing'), kind: 'doing', color: null, position: keys[1]! },
    { board_id: board.id, name: t('board.col.done'), kind: 'done', color: null, position: keys[2]! },
  ]);
  return board;
}

export const renameBoard = (id: string, name: string) => upsert('boards', { id, name });
export const archiveBoard = (id: string, archived: boolean) => upsert('boards', { id, archived_at: archived ? new Date().toISOString() : null });

/** Move a board to `toIndex` among active boards. */
export async function moveBoard(id: string, toIndex: number) {
  const others = (await boardsSorted()).filter((b) => b.id !== id && !b.archived_at);
  await upsert('boards', { id, position: positionAt(others, toIndex) });
}

/** Deletes a board with its columns and cards (soft delete, so it syncs). */
export async function deleteBoard(id: string) {
  const db = getDb();
  const cols = await db.columns.where('board_id').equals(id).primaryKeys();
  const cards = await db.cards.where('board_id').equals(id).primaryKeys();
  await softDelete('cards', cards);
  await softDelete('columns', cols);
  await softDelete('boards', [id]);
}

// ── Columns ─────────────────────────────────────────────────────────────────

export async function createColumn(boardId: string, name: string): Promise<Column> {
  const cols = await columnsOf(boardId);
  return upsert('columns', { board_id: boardId, name, kind: null, color: null, position: positionAt(cols, cols.length) });
}

export const updateColumn = (id: string, patch: Partial<Pick<Column, 'name' | 'color' | 'kind'>>) => upsert('columns', { id, ...patch });

export async function moveColumn(boardId: string, id: string, toIndex: number) {
  const others = (await columnsOf(boardId)).filter((c) => c.id !== id);
  await upsert('columns', { id, position: positionAt(others, toIndex) });
}

/** Returns the ids it removed so the caller can offer Undo. */
export async function deleteColumn(id: string): Promise<{ column: string; cards: string[] }> {
  const cards = live(await getDb().cards.where('column_id').equals(id).toArray()).map((c) => c.id);
  await softDelete('cards', cards);
  await softDelete('columns', [id]);
  return { column: id, cards };
}

export async function restore(table: 'cards' | 'columns' | 'boards' | 'checklist_items', ids: string[]) {
  await upsertMany(table, ids.map((id) => ({ id, deleted_at: null })));
}

// ── Cards ───────────────────────────────────────────────────────────────────

export type NewCard = Partial<Card> & { board_id: string; column_id: string; title: string };

export async function createCard(input: NewCard): Promise<Card> {
  const siblings = await cardsIn(input.column_id);
  const column = await getDb().columns.get(input.column_id);
  return upsert('cards', {
    subject_id: null,
    description: '',
    notes: '',
    due_at: null,
    due_has_time: false,
    priority: 'med',
    labels: [],
    is_exam: false,
    estimate_min: null,
    repeat_rule: null,
    completed_at: column?.kind === 'done' ? new Date().toISOString() : null,
    is_sample: false,
    reminder_offsets: null,
    ...input,
    position: positionAt(siblings, siblings.length),
  });
}

export const updateCard = (id: string, patch: Partial<Card>) => upsert('cards', { id, ...patch });

/**
 * Move a card to `toColumnId` between two neighbours (by id; null = list edge).
 * Entering a "done" column completes it; leaving one reopens it.
 * Completing a repeating card schedules its next occurrence.
 */
export async function moveCard(cardId: string, toColumnId: string, prevId: string | null, nextId: string | null) {
  const db = getDb();
  const [card, column, prev, next] = await Promise.all([
    db.cards.get(cardId),
    db.columns.get(toColumnId),
    prevId ? db.cards.get(prevId) : undefined,
    nextId ? db.cards.get(nextId) : undefined,
  ]);
  if (!card || !column) return;

  const wasDone = Boolean(card.completed_at);
  const isDone = column.kind === 'done';
  const patch: Partial<Card> = {
    column_id: toColumnId,
    board_id: column.board_id,
    position: positionBetween(prev?.position, next?.position),
  };
  if (isDone && !wasDone) {
    patch.completed_at = new Date().toISOString();
    playUi('complete');
  }
  if (!isDone && wasDone) patch.completed_at = null;

  if (isDone && !wasDone && card.repeat_rule && card.due_at) {
    await spawnNextOccurrence(card);
    patch.repeat_rule = null; // the finished copy keeps its history but stops repeating
  }
  await upsert('cards', { id: cardId, ...patch });
}

/** Move a card to the end of another column (e.g. from the status picker). */
export async function moveCardToEnd(cardId: string, columnId: string) {
  const list = (await cardsIn(columnId)).filter((c) => c.id !== cardId);
  await moveCard(cardId, columnId, list.at(-1)?.id ?? null, null);
}

/** Mark done / not done from anywhere (e.g. card details), moving it to the right column. */
export async function setCardDone(card: Card, done: boolean) {
  const cols = await columnsOf(card.board_id);
  const target = done ? cols.find((c) => c.kind === 'done') ?? cols.at(-1) : cols.find((c) => c.kind === 'todo') ?? cols[0];
  if (!target) return;
  if (target.id === card.column_id) {
    await updateCard(card.id, { completed_at: done ? new Date().toISOString() : null });
    if (done) playUi('complete');
    return;
  }
  // Lands at the top of the target column.
  const list = await cardsIn(target.id);
  await moveCard(card.id, target.id, null, list[0]?.id ?? null);
}

async function spawnNextOccurrence(card: Card) {
  const due = nextOccurrence(new Date(card.due_at!), card.repeat_rule!);
  if (!due) return;
  const cols = await columnsOf(card.board_id);
  const todo = cols.find((c) => c.kind === 'todo') ?? cols.find((c) => c.kind !== 'done') ?? cols[0];
  if (!todo) return;
  const copy = await createCard({
    ...stripMeta(card),
    board_id: card.board_id,
    column_id: todo.id,
    title: card.title,
    due_at: due.toISOString(),
    completed_at: null,
  });
  const items = live(await getDb().checklist_items.where('card_id').equals(card.id).toArray()).sort(byPosition);
  if (items.length) {
    await upsertMany(
      'checklist_items',
      items.map((i) => ({ card_id: copy.id, text: i.text, done: false, position: i.position })),
    );
  }
}

function stripMeta(card: Card): Partial<Card> {
  const { id: _i, user_id: _u, created_at: _c, updated_at: _up, deleted_at: _d, position: _p, ...rest } = card;
  return rest;
}

export async function duplicateCard(card: Card): Promise<Card> {
  const db = getDb();
  const siblings = await cardsIn(card.column_id);
  const idx = siblings.findIndex((c) => c.id === card.id);
  const copy = await upsert('cards', {
    ...stripMeta(card),
    id: newId(),
    title: card.title,
    position: positionBetween(card.position, siblings[idx + 1]?.position),
    is_sample: false,
  });
  const items = live(await db.checklist_items.where('card_id').equals(card.id).toArray()).sort(byPosition);
  if (items.length) {
    await upsertMany(
      'checklist_items',
      items.map((i) => ({ card_id: copy.id, text: i.text, done: i.done, position: i.position })),
    );
  }
  return copy;
}

export async function deleteCards(ids: string[]) {
  await softDelete('cards', ids);
}

// ── Checklist ───────────────────────────────────────────────────────────────

async function itemsOf(cardId: string): Promise<ChecklistItem[]> {
  return live(await getDb().checklist_items.where('card_id').equals(cardId).toArray()).sort(byPosition);
}

export async function addChecklistItem(cardId: string, text: string) {
  const items = await itemsOf(cardId);
  return upsert('checklist_items', { card_id: cardId, text, done: false, position: positionAt(items, items.length) });
}
export const updateChecklistItem = (id: string, patch: Partial<Pick<ChecklistItem, 'text' | 'done'>>) =>
  upsert('checklist_items', { id, ...patch });
export const deleteChecklistItem = (id: string) => softDelete('checklist_items', [id]);
export async function moveChecklistItem(cardId: string, id: string, toIndex: number) {
  const others = (await itemsOf(cardId)).filter((i) => i.id !== id);
  await upsert('checklist_items', { id, position: positionAt(others, toIndex) });
}
