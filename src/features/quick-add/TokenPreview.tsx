import { CalendarClock, Flag, Hash, Signal, Timer } from 'lucide-react';
import type { ParsedCard } from './parse';
import type { Subject } from '@/types/database';
import { useI18n, useT } from '@/lib/i18n';
import { formatTime, relativeDay } from '@/lib/dates';
import { SubjectChip } from '@/features/subjects/SubjectChip';
import { Badge } from '@/components/ui';

/** Live chips showing what the quick-add parser understood. */
export function TokenPreview({ parsed, subject }: { parsed: ParsedCard; subject?: Subject }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const items = [];
  if (parsed.dueAt)
    items.push(
      <Badge key="due" tone="accent">
        <CalendarClock size={12} aria-hidden />
        {relativeDay(parsed.dueAt, lang)}
        {parsed.hasTime && ` · ${formatTime(parsed.dueAt, lang)}`}
      </Badge>,
    );
  if (subject) items.push(<SubjectChip key="subject" subject={subject} className="!h-5" />);
  if (parsed.isExam)
    items.push(
      <Badge key="exam" tone="danger">
        <Flag size={12} aria-hidden />
        {t('card.exam')}
      </Badge>,
    );
  if (parsed.priority && parsed.priority !== 'med')
    items.push(
      <Badge key="prio" tone={parsed.priority === 'high' ? 'warning' : 'neutral'}>
        <Signal size={12} aria-hidden />
        {t(`prio.${parsed.priority}`)}
      </Badge>,
    );
  if (parsed.estimateMin)
    items.push(
      <Badge key="est">
        <Timer size={12} aria-hidden />
        {t('board.minutes', { n: parsed.estimateMin })}
      </Badge>,
    );
  for (const l of parsed.labels)
    items.push(
      <Badge key={`l-${l}`}>
        <Hash size={12} aria-hidden />
        {l}
      </Badge>,
    );
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
      {items}
    </div>
  );
}
