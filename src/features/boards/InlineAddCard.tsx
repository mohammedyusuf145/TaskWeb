import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSubjects } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/features/settings/settings';
import { parseQuickAdd } from '@/features/quick-add/parse';
import { TokenPreview } from '@/features/quick-add/TokenPreview';
import { Button } from '@/components/ui';
import { createCard } from './ops';

/** "Add a card" at the bottom of a column. Uses the same natural-language parser as quick-add. */
export function InlineAddCard({ boardId, columnId }: { boardId: string; columnId: string }) {
  const t = useT();
  const subjects = useSubjects();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const parsed = parseQuickAdd(text, { now: new Date(), subjects: subjects ?? [], weekStart: settings.week_start });

  async function add() {
    const title = (parsed.title || text).trim();
    if (!title) return;
    await createCard({
      board_id: boardId,
      column_id: columnId,
      title: title.slice(0, 300),
      subject_id: parsed.subjectId,
      due_at: parsed.dueAt?.toISOString() ?? null,
      due_has_time: parsed.hasTime,
      priority: parsed.priority ?? 'med',
      is_exam: parsed.isExam,
      labels: parsed.labels,
      estimate_min: parsed.estimateMin,
    });
    setText('');
    ref.current?.focus();
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-card px-2 text-sm text-text-3 transition-colors hover:bg-surface-2 hover:text-text-2"
      >
        <Plus size={15} aria-hidden />
        {t('col.addCard')}
      </button>
    );

  return (
    <div className="rounded-card border border-border-strong bg-surface-2 p-2 raised">
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        value={text}
        dir="auto"
        aria-label={t('col.addCard')}
        placeholder={t('qa.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void add();
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setText('');
          }
        }}
        onBlur={() => !text.trim() && setOpen(false)}
        className="w-full resize-none bg-transparent px-1 text-base text-text placeholder:text-text-3 focus:outline-none"
      />
      {text.trim() && parsed.title !== text.trim() && (
        <div className="px-1 pb-2">
          <TokenPreview parsed={parsed} subject={subjects?.find((s) => s.id === parsed.subjectId)} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onMouseDown={(e) => e.preventDefault()} onClick={add} disabled={!text.trim()}>
          {t('c.add')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
        >
          {t('c.cancel')}
        </Button>
      </div>
    </div>
  );
}
