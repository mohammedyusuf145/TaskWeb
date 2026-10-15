import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger' | 'warning';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-3 text-text-2',
    accent: 'bg-accent-soft text-accent-text',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
  };
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-chip px-1.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border-strong bg-surface-1 px-1 font-sans text-[11px] text-text-2 ${className ?? ''}`} dir="ltr">
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('anim-shimmer rounded-card bg-surface-3', className)} />;
}

/** Circular progress. `value` 0..1. */
export function ProgressRing({
  value,
  size = 40,
  stroke = 3,
  color = 'var(--accent)',
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--motion-standard)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

/** Thin progress bar for checklists. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)] ease-standard" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
