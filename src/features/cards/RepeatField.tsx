import type { RepeatRule } from '@/types/database';
import { useI18n, useT } from '@/lib/i18n';
import { weekdayName, weekdayOrder } from '@/lib/dates';
import { useSettings } from '@/features/settings/settings';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui';

type Mode = 'none' | 'daily' | 'weekly' | 'custom';

function modeOf(rule: RepeatRule | null): Mode {
  if (!rule) return 'none';
  if (rule.freq === 'daily' && rule.interval === 1) return 'daily';
  if (rule.freq === 'weekly' && rule.interval === 1 && (rule.weekdays?.length ?? 0) <= 1) return 'weekly';
  return 'custom';
}

export function RepeatField({ rule, due, onChange }: { rule: RepeatRule | null; due: Date | null; onChange: (r: RepeatRule | null) => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const { week_start } = useSettings();
  const mode = modeOf(rule);
  const dueDay = due?.getDay() ?? 0;

  const setMode = (m: Mode) => {
    if (m === 'none') onChange(null);
    if (m === 'daily') onChange({ freq: 'daily', interval: 1 });
    if (m === 'weekly') onChange({ freq: 'weekly', interval: 1, weekdays: [dueDay] });
    if (m === 'custom') onChange({ freq: 'weekly', interval: 1, weekdays: [dueDay] });
  };

  if (!due) return <p className="flex h-10 items-center text-sm text-text-3">{t('repeat.needsDue')}</p>;

  const unit = rule?.freq === 'weekly' ? 'weeks' : 'days';

  return (
    <div className="flex flex-col gap-2">
      <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label={t('card.repeat')}>
        <option value="none">{t('repeat.none')}</option>
        <option value="daily">{t('repeat.daily')}</option>
        <option value="weekly">{t('repeat.weekly')}</option>
        <option value="custom">{t('repeat.custom')}</option>
      </Select>
      {mode === 'custom' && rule && (
        <div className="flex flex-col gap-2 rounded-control border border-border bg-surface-1 p-2.5">
          <div className="flex items-center gap-2 text-sm text-text-2">
            <span>{t('repeat.every')}</span>
            <input
              type="number"
              min={1}
              max={52}
              value={rule.interval}
              onChange={(e) => onChange({ ...rule, interval: Math.min(52, Math.max(1, Number(e.target.value) || 1)) })}
              aria-label={t('repeat.every')}
              className="h-8 w-14 rounded-control border border-border-strong bg-surface-2 px-2 text-center text-base text-text tabular focus:border-accent focus:outline-none"
            />
            <select
              value={unit}
              onChange={(e) =>
                onChange(e.target.value === 'weeks' ? { freq: 'weekly', interval: rule.interval, weekdays: [dueDay] } : { freq: 'custom', interval: rule.interval })
              }
              aria-label={t('repeat.every')}
              className="h-8 rounded-control border border-border-strong bg-surface-2 px-2 text-base text-text focus:border-accent focus:outline-none"
            >
              <option value="days">{t('repeat.unitDays')}</option>
              <option value="weeks">{t('repeat.unitWeeks')}</option>
            </select>
          </div>
          {unit === 'weeks' && (
            <div role="group" aria-label={t('repeat.on')} className="flex flex-wrap gap-1">
              {weekdayOrder(week_start).map((d) => {
                const on = rule.weekdays?.includes(d) ?? false;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={weekdayName(d, lang)}
                    onClick={() => {
                      const set = new Set(rule.weekdays ?? []);
                      if (on && set.size > 1) set.delete(d);
                      else set.add(d);
                      onChange({ ...rule, weekdays: [...set].sort() });
                    }}
                    className={cn(
                      'inline-flex h-8 min-w-9 items-center justify-center rounded-control border px-1.5 text-xs transition-colors',
                      on ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-3 hover:text-text-2',
                    )}
                  >
                    {weekdayName(d, lang, 'short')}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {mode !== 'none' && <p className="text-xs text-text-3">{t('repeat.hint')}</p>}
    </div>
  );
}
