import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Check, Columns3, LayoutGrid, Plus, Search, Trash2, X } from 'lucide-react';
import { useBoards, useCards, useColumns, useSubjects } from '@/lib/db/hooks';
import { softDelete, upsertMany } from '@/lib/db/repo';
import { useT } from '@/lib/i18n';
import { useHotkeys } from '@/lib/hotkeys';
import { cn } from '@/lib/cn';
import { Button, EmptyState, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Skeleton, toast } from '@/components/ui';
import { PageHeader } from '@/app/shell/PageHeader';
import { BoardCanvas } from '@/features/boards/BoardCanvas';
import { BoardSwitcher } from '@/features/boards/BoardSwitcher';
import { FilterPopover } from '@/features/boards/FilterPopover';
import { activeFilterCount, matchesFilters, useBoardView, type GroupBy } from '@/features/boards/view';
import { createBoard } from '@/features/boards/ops';
import { CardDetail } from '@/features/cards/CardDetail';
import { useCurrentBoard, useQuickAdd } from '@/features/quick-add/store';

export function BoardPage() {
  const t = useT();
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [params, setParams] = useSearchParams();
  const openCardId = params.get('card');

  const boards = useBoards();
  const board = boards?.find((b) => b.id === boardId) ?? boards?.[0];
  const columns = useColumns(board?.id);
  const allCards = useCards(board?.id);
  const subjects = useSubjects();
  const { filters, setFilters, clearFilters, groupBy, setGroupBy } = useBoardView();
  const searchRef = useRef<HTMLInputElement>(null);
  const [now] = useState(() => new Date());

  const setCurrentBoard = useCurrentBoard((s) => s.set);
  useEffect(() => setCurrentBoard(board?.id ?? null), [board?.id, setCurrentBoard]);

  useHotkeys({ '/': () => searchRef.current?.focus() });

  const cards = useMemo(() => (allCards ?? []).filter((c) => matchesFilters(c, filters, now)), [allCards, filters, now]);
  const filtering = activeFilterCount(filters) > 0 || filters.search.trim().length > 0;
  const samples = allCards?.filter((c) => c.is_sample) ?? [];
  const loading = boards === undefined || (board && (columns === undefined || allCards === undefined || subjects === undefined));

  const openCard = (id: string) => setParams((p) => (p.set('card', id), p));
  const closeCard = () =>
    setParams(
      (p) => {
        p.delete('card');
        return p;
      },
      { replace: true },
    );

  async function clearSamples() {
    const ids = samples.map((c) => c.id);
    await softDelete('cards', ids);
    toast(t('board.samplesRemoved'), {
      tone: 'success',
      action: { label: t('c.undo'), onClick: () => void upsertMany('cards', ids.map((id) => ({ id, deleted_at: null }))) },
    });
  }

  if (boards && boards.length === 0) {
    return (
      <>
        <PageHeader title={t('nav.board')} />
        <div className="mx-auto max-w-[var(--content-max)] px-4 py-10 md:px-8">
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title={t('board.noBoards.title')}
            body={t('board.noBoards.body')}
            action={
              <Button
                variant="primary"
                iconStart={<Plus size={16} />}
                onClick={async () => {
                  const b = await createBoard(t('board.defaultName'));
                  navigate(`/board/${b.id}`);
                }}
              >
                {t('board.new')}
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col md:h-dvh">
      <PageHeader
        title={<BoardSwitcher current={board} />}
        meta={allCards && t('board.cards', { n: allCards.length })}
      />

      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 md:px-8">
        <div className="relative min-w-[150px] flex-1 sm:max-w-[320px]">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-3" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilters({ search: '' });
                e.currentTarget.blur();
              }
            }}
            placeholder={t('board.search')}
            aria-label={t('board.search')}
            aria-keyshortcuts="/"
            dir="auto"
            className={cn('h-9 w-full rounded-control border border-border bg-surface-1 ps-9 text-base', filters.search ? 'pe-9' : 'pe-3 md:pe-9', ' text-text placeholder:text-text-3 transition-colors hover:border-border-strong focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden')}
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() => setFilters({ search: '' })}
              aria-label={t('c.close')}
              className="absolute end-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-text-3 hover:text-text"
            >
              <X size={14} />
            </button>
          ) : (
            <span className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 md:block">
              <Kbd>/</Kbd>
            </span>
          )}
        </div>
        <FilterPopover />
        <GroupMenu value={groupBy} onChange={setGroupBy} />
        <span className="flex-1" />
        {samples.length > 0 && (
          <Button variant="ghost" size="sm" iconStart={<Trash2 size={14} />} onClick={clearSamples} aria-label={t('board.clearSamples')}>
            <span className="max-lg:sr-only">{t('board.clearSamples')}</span>
          </Button>
        )}
        <Button variant="primary" size="sm" iconStart={<Plus size={15} />} onClick={() => useQuickAdd.getState().show({ boardId: board?.id })} aria-keyshortcuts="n">
          <span className="max-sm:sr-only">{t('board.newCard')}</span>
        </Button>
      </div>

      {loading || !board ? (
        <BoardSkeleton />
      ) : (
        <>
          {allCards!.length === 0 && !filtering && (
            <div className="mx-auto w-full max-w-[var(--content-max)] px-4 pt-6 md:px-8">
              <EmptyState
                title={t('board.empty.title')}
                body={t('board.empty.body')}
                action={
                  <Button variant="primary" iconStart={<Plus size={16} />} onClick={() => useQuickAdd.getState().show({ boardId: board.id })}>
                    {t('board.newCard')}
                  </Button>
                }
              />
            </div>
          )}
          {filtering && cards.length === 0 && allCards!.length > 0 && (
            <div role="status" className="mx-auto flex w-full max-w-[var(--content-max)] flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-8">
              <p className="text-base text-text">{t('board.noMatch.title')}</p>
              <p className="text-sm text-text-3">{t('board.noMatch.body')}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearFilters();
                  setFilters({ search: '' });
                }}
              >
                {t('filter.clear')}
              </Button>
            </div>
          )}
          {groupBy === 'due' && (
            <p className="mx-auto w-full max-w-[var(--content-max)] px-4 pt-3 text-xs text-text-3 md:px-8">{t('group.dueHint')}</p>
          )}
          <BoardCanvas boardId={board.id} columns={columns!} cards={cards} subjects={subjects!} groupBy={groupBy} onOpenCard={openCard} />
        </>
      )}

      <CardDetail cardId={openCardId} onClose={closeCard} />
    </div>
  );
}

function GroupMenu({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  const t = useT();
  const options: GroupBy[] = ['column', 'subject', 'priority', 'due'];
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" variant={value === 'column' ? 'ghost' : 'secondary'} iconStart={<Columns3 size={15} />} aria-label={`${t('board.group')}: ${t(`group.${value}`)}`}>
          <span className="max-md:sr-only">{value === 'column' ? t('board.group') : t(`group.${value}`)}</span>
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>{t('board.group')}</MenuLabel>
        {options.map((g) => (
          <MenuItem key={g} onSelect={() => onChange(g)} icon={g === value ? <Check size={15} className="text-accent" /> : <span className="inline-block w-[15px]" />}>
            {t(`group.${g}`)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function BoardSkeleton() {
  return (
    <div className={cn('flex gap-4 overflow-hidden px-4 py-5 md:px-8')} aria-busy="true">
      {[3, 2, 1].map((n, i) => (
        <div key={i} className="flex w-[85vw] max-w-[340px] shrink-0 flex-col gap-2 md:w-[300px]">
          <Skeleton className="mb-2 h-4 w-24" />
          {Array.from({ length: n }, (_, j) => (
            <Skeleton key={j} className="h-[72px]" />
          ))}
        </div>
      ))}
    </div>
  );
}
