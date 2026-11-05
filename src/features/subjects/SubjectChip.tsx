import type { Subject } from '@/types/database';
import { subjectColor } from '@/design/tokens';
import { cn } from '@/lib/cn';
import { SubjectIcon } from './icons';

export function SubjectDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: subjectColor(color) }} />;
}

/** Tinted chip: subject colour at low opacity with readable text. */
export function SubjectChip({ subject, className }: { subject: Pick<Subject, 'name' | 'color' | 'icon'>; className?: string }) {
  const c = subjectColor(subject.color);
  return (
    <span
      className={cn('inline-flex h-6 max-w-full items-center gap-1.5 rounded-chip px-2 text-xs font-medium', className)}
      style={{ background: `color-mix(in oklab, ${c} 14%, transparent)`, color: c }}
    >
      <SubjectIcon name={subject.icon} size={12} />
      <span className="truncate">{subject.name}</span>
    </span>
  );
}
