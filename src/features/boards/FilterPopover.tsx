import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import type { Priority } from '@/types/database';
import { useAllCards, useSubjects } from '@/lib/db/hooks';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { subjectColor } from '@/design/tokens';
import { Button, Popover, PopoverContent, PopoverTrigger, Switch } from '@/components/ui';
import { activeFilterCount, useBoardView, type DueFilter } from './view';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-sm transition-colors',
        on ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-2 hover:border-border-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FilterPopover() {
  const t = useT();
  const { filters, setFilters, clearFilters } = useBoardView();
  const subjects = useSubjects() ?? [];
  const cards = useAllCards();
  const labels = [...new Set((cards ?? []).flatMap((c) => c.labels))].sort().slice(0, 30);
  const count = activeFilterCount(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={count ? 'secondary' : 'ghost'} iconStart={<ListFilter size={15} />} aria-label={t('board.filter')}>
          <span className="max-md:sr-only">{t('board.filter')}</span>
          {count > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink tabular">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] !p-4">
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-text-3">{t('filter.subject')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <Chip key={s.id} on={filters.subjects.includes(s.id)} onClick={() => setFilters({ subjects: toggle(filters.subjects, s.id) })}>
                  <span className="size-2 rounded-full" style={{ background: subjectColor(s.color) }} aria-hidden />
                  {s.name}
                </Chip>
              ))}
              <Chip on={filters.subjects.includes('none')} onClick={() => setFilters({ subjects: toggle(filters.subjects, 'none') })}>
                {t('subject.none')}
              </Chip>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-text-3">{t('filter.priority')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['high', 'med', 'low'] as Priority[]).map((p) => (
                <Chip key={p} on={filters.priorities.includes(p)} onClick={() => setFilters({ priorities: toggle(filters.priorities, p) })}>
                  {t(`prio.${p}`)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-text-3">{t('filter.due')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['any', 'overdue', 'today', 'week', 'none'] as DueFilter[]).map((d) => (
                <Chip key={d} on={filters.due === d} onClick={() => setFilters({ due: d })}>
                  {t(`filter.due.${d}`)}
                </Chip>
              ))}
            </div>
          </fieldset>
          {labels.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-text-3">{t('filter.labels')}</legend>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <Chip key={l} on={filters.labels.includes(l)} onClick={() => setFilters({ labels: toggle(filters.labels, l) })}>
                    <span dir="auto">{l}</span>
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
          <Switch checked={filters.examsOnly} onCheckedChange={(v) => setFilters({ examsOnly: v })} label={t('filter.exams')} />
          {count > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="self-start">
              {t('filter.clear')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
