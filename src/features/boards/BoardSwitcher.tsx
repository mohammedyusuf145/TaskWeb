import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, ChevronDown, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import type { Board } from '@/types/database';
import { useAllBoards } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { Button, Dialog, IconButton, Input, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, toast } from '@/components/ui';
import { archiveBoard, createBoard, deleteBoard, moveBoard, renameBoard } from './ops';

/** Board name in the page header doubles as the switcher. */
export function BoardSwitcher({ current }: { current: Board | undefined }) {
  const t = useT();
  const navigate = useNavigate();
  const all = useAllBoards() ?? [];
  const active = all.filter((b) => !b.archived_at);
  const [naming, setNaming] = useState<{ mode: 'new' | 'rename'; board?: Board } | null>(null);
  const [managing, setManaging] = useState(false);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`${t('board.switch')}: ${current?.name ?? ''}`}
            className="-mx-2 flex min-w-0 items-center gap-1.5 rounded-control px-2 py-1 text-start hover:bg-surface-2 data-[state=open]:bg-surface-2"
          >
            <h1 className="truncate text-lg font-semibold text-text md:text-xl">{current?.name ?? t('nav.board')}</h1>
            <ChevronDown size={16} className="shrink-0 text-text-3" />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          {active.map((b) => (
            <MenuItem key={b.id} onSelect={() => navigate(`/board/${b.id}`)} icon={b.id === current?.id ? <Check size={15} className="text-accent" /> : <span className="inline-block w-[15px]" />}>
              {b.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          {current && (
            <MenuItem icon={<Pencil size={15} />} onSelect={() => setNaming({ mode: 'rename', board: current })}>
              {t('board.rename')}
            </MenuItem>
          )}
          <MenuItem icon={<Plus size={15} />} onSelect={() => setNaming({ mode: 'new' })}>
            {t('board.new')}
          </MenuItem>
          <MenuItem icon={<Settings2 size={15} />} onSelect={() => setManaging(true)}>
            {t('board.manage')}
          </MenuItem>
        </MenuContent>
      </Menu>

      <NameDialog
        state={naming}
        onClose={() => setNaming(null)}
        onSubmit={async (name) => {
          if (naming?.mode === 'rename' && naming.board) await renameBoard(naming.board.id, name);
          else {
            const b = await createBoard(name);
            navigate(`/board/${b.id}`);
          }
          setNaming(null);
        }}
      />
      <ManageBoardsDialog open={managing} onOpenChange={setManaging} boards={all} currentId={current?.id} />
    </>
  );
}

function NameDialog({ state, onClose, onSubmit }: { state: { mode: 'new' | 'rename'; board?: Board } | null; onClose: () => void; onSubmit: (name: string) => Promise<void> }) {
  const t = useT();
  const [name, setName] = useState('');
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    setName(state?.board?.name ?? '');
  }
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(v) => !v && onClose()}
      title={state?.mode === 'rename' ? t('board.rename') : t('board.new')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('c.cancel')}
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSubmit(name.trim().slice(0, 80))}>
            {state?.mode === 'rename' ? t('c.save') : t('c.add')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void onSubmit(name.trim().slice(0, 80));
        }}
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={t('board.name')} placeholder={t('board.name')} maxLength={80} />
      </form>
    </Dialog>
  );
}

function ManageBoardsDialog({ open, onOpenChange, boards, currentId }: { open: boolean; onOpenChange: (v: boolean) => void; boards: Board[]; currentId?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const active = boards.filter((b) => !b.archived_at);
  const archived = boards.filter((b) => b.archived_at);
  const [confirm, setConfirm] = useState<Board | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} title={t('board.manage')} className="max-w-[520px]">
        <ul className="-mx-2 flex flex-col">
          {active.map((b, i) => (
            <li key={b.id} className="flex h-11 items-center gap-1 rounded-control px-2 hover:bg-surface-3">
              <span className="min-w-0 flex-1 truncate text-base text-text">{b.name}</span>
              <IconButton size="sm" label={t('board.moveUp')} icon={<ArrowUp size={15} />} disabled={i === 0} onClick={() => moveBoard(b.id, i - 1)} />
              <IconButton size="sm" label={t('board.moveDown')} icon={<ArrowDown size={15} />} disabled={i === active.length - 1} onClick={() => moveBoard(b.id, i + 1)} />
              <IconButton
                size="sm"
                label={t('board.archive')}
                icon={<Archive size={15} />}
                onClick={async () => {
                  await archiveBoard(b.id, true);
                  if (b.id === currentId) navigate('/board');
                  toast(t('board.archivedToast'), { action: { label: t('c.undo'), onClick: () => void archiveBoard(b.id, false) } });
                }}
              />
            </li>
          ))}
        </ul>
        {archived.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 text-xs font-medium text-text-3">{t('board.archived')}</h3>
            <ul className="-mx-2 flex flex-col">
              {archived.map((b) => (
                <li key={b.id} className="flex h-11 items-center gap-1 rounded-control px-2 hover:bg-surface-3">
                  <span className="min-w-0 flex-1 truncate text-base text-text-3">{b.name}</span>
                  <IconButton size="sm" label={t('board.unarchive')} icon={<ArchiveRestore size={15} />} onClick={() => archiveBoard(b.id, false)} />
                  <IconButton size="sm" label={t('board.deleteForever')} icon={<Trash2 size={15} />} onClick={() => setConfirm(b)} className="hover:!text-danger" />
                </li>
              ))}
            </ul>
          </>
        )}
      </Dialog>
      <Dialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={t('board.deleteForever')}
        description={confirm ? t('board.deleteConfirm', { name: confirm.name }) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t('c.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm) await deleteBoard(confirm.id);
                setConfirm(null);
              }}
            >
              {t('c.delete')}
            </Button>
          </>
        }
      />
    </>
  );
}
