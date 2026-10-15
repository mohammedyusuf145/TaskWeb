import { useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { useWidth } from '@/lib/useWidth';
import { cn } from '@/lib/cn';
import { formatDuration } from './aggregate';

/** Clean tick step (minutes) so the axis has at most four labelled lines. */
export function niceStep(max: number): number {
  for (const s of [5, 10, 15, 30, 60, 120, 180, 240, 360, 480]) if (max / s <= 4) return s;
  return 600;
}

export interface Series {
  id: string;
  name: string;
  color: string;
}

export interface StackDatum {
  key: string;
  label: string;
  /** Full label for tooltip and table. */
  title: string;
  values: Record<string, number>;
  emphasis?: boolean;
}

/** Path for a bar with a 4px rounded data-end (top) and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const w = 200;
  const left = Math.min(Math.max(0, x - w / 2), width - w);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-[200px] rounded-pop border border-border bg-surface-3 p-2.5 text-xs shadow-pop"
      style={{ left, top: Math.max(0, y) }}
    >
      {children}
    </div>
  );
}

function Row({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-text-2">{name}</span>
      <span className="font-medium text-text tabular">{value}</span>
    </div>
  );
}

/**
 * Stacked columns (minutes per day by subject). Thin columns (<=24px) with a rounded data-end,
 * a 2px surface gap between segments, hairline grid, hover/focus tooltip per column.
 * Series stack in their fixed palette order. Mirrors for RTL.
 */
export function StackedColumns({ data, series, height = 220, label }: { data: StackDatum[]; series: Series[]; height?: number; label: string }) {
  const lang = useI18n((s) => s.lang);
  const rtl = lang === 'ar';
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.id] ?? 0), 0));
  const max = Math.max(30, ...totals);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const pad = { t: 8, b: 26, s: 40, e: 4 };
  const plotW = Math.max(0, width - pad.s - pad.e);
  const plotH = height - pad.t - pad.b;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(4, Math.min(24, slot * 0.62));
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const xOf = (i: number) => {
    const center = pad.s + slot * i + slot / 2;
    return rtl ? width - center : center;
  };
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const every = data.length > 14 ? 7 : 1;

  return (
    <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block max-w-full">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={rtl ? pad.e : pad.s} x2={rtl ? width - pad.s : width - pad.e} y1={y(tk)} y2={y(tk)} stroke="var(--border)" strokeWidth={1} />
              <text x={rtl ? width - pad.s + 8 : pad.s - 8} y={y(tk)} dy="0.32em" textAnchor={rtl ? 'start' : 'end'} className="fill-[var(--text-3)] text-[11px] tabular">
                {formatDuration(tk, lang)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            let acc = 0;
            const cx = xOf(i);
            const dim = active !== null && active !== i;
            const segs = series.filter((s) => (d.values[s.id] ?? 0) > 0);
            return (
              <g key={d.key} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity var(--dur-fast)' }}>
                {segs.map((s, si) => {
                  const v = d.values[s.id]!;
                  const y0 = y(acc);
                  acc += v;
                  const y1 = y(acc);
                  const isTop = si === segs.length - 1;
                  // 2px surface gap above every segment except the top one.
                  const h = Math.max(1, y0 - y1 - (isTop ? 0 : 2));
                  return isTop ? (
                    <path key={s.id} d={barPath(cx - barW / 2, y1, barW, h)} fill={s.color} />
                  ) : (
                    <rect key={s.id} x={cx - barW / 2} y={y1 + 2} width={barW} height={h} fill={s.color} />
                  );
                })}
                {(i % every === 0 || d.emphasis) && (
                  <text x={cx} y={height - 8} textAnchor="middle" className={cn('text-[11px]', d.emphasis ? 'fill-[var(--text)] font-medium' : 'fill-[var(--text-3)]')}>
                    {d.label}
                  </text>
                )}
                <rect
                  x={cx - slot / 2}
                  y={pad.t}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.title}: ${formatDuration(totals[i]!, lang)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-[var(--accent)] focus-visible:stroke-2"
                />
              </g>
            );
          })}
          <line x1={rtl ? pad.e : pad.s} x2={rtl ? width - pad.s : width - pad.e} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" />
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={xOf(active)} y={Math.max(0, y(totals[active]!) - 8 - 24 - series.filter((s) => data[active]!.values[s.id]).length * 20)} width={width}>
          <p className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-text-2">{data[active]!.title}</span>
            <span className="text-sm font-semibold text-text tabular">{formatDuration(totals[active]!, lang)}</span>
          </p>
          {series
            .filter((s) => data[active]!.values[s.id])
            .map((s) => (
              <Row key={s.id} color={s.color} name={s.name} value={formatDuration(data[active]!.values[s.id]!, lang)} />
            ))}
        </Tooltip>
      )}
    </div>
  );
}

/** Single-series columns (focus by hour of day); the best window is drawn at full strength. */
export function HourColumns({ hours, highlight, color, label, hourLabel }: { hours: number[]; highlight: Set<number>; color: string; label: string; hourLabel: (h: number) => string }) {
  const lang = useI18n((s) => s.lang);
  const rtl = lang === 'ar';
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 140;
  const pad = { t: 6, b: 22, s: 4, e: 4 };
  const plotW = Math.max(0, width - pad.s - pad.e);
  const plotH = height - pad.t - pad.b;
  const max = Math.max(1, ...hours);
  const slot = plotW / 24;
  const barW = Math.max(3, Math.min(16, slot - 2));
  const xOf = (h: number) => {
    const c = pad.s + slot * h + slot / 2;
    return rtl ? width - c : c;
  };
  const yOf = (v: number) => pad.t + plotH - (v / max) * plotH;
  return (
    <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block max-w-full">
          {hours.map((v, h) => (
            <g key={h}>
              {v > 0 && (
                <path
                  d={barPath(xOf(h) - barW / 2, yOf(v), barW, pad.t + plotH - yOf(v), 3)}
                  fill={color}
                  opacity={(active === null ? (highlight.has(h) ? 1 : 0.42) : active === h ? 1 : 0.3)}
                  style={{ transition: 'opacity var(--dur-fast)' }}
                />
              )}
              {h % 6 === 0 && (
                <text x={xOf(h)} y={height - 6} textAnchor="middle" className="fill-[var(--text-3)] text-[11px]">
                  {hourLabel(h)}
                </text>
              )}
              <rect
                x={xOf(h) - slot / 2}
                y={pad.t}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${hourLabel(h)}: ${formatDuration(v, lang)}`}
                onMouseEnter={() => setActive(h)}
                onFocus={() => setActive(h)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-[var(--accent)] focus-visible:stroke-2"
              />
            </g>
          ))}
          <line x1={pad.s} x2={width - pad.e} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--border-strong)" />
        </svg>
      )}
      {active !== null && (
        <Tooltip x={xOf(active)} y={Math.max(0, yOf(hours[active]!) - 56)} width={width}>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-text-2">{hourLabel(active)}</span>
            <span className="text-sm font-semibold text-text tabular">{formatDuration(hours[active]!, lang)}</span>
          </p>
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal bars with direct labels (name + value), sorted by size. */
export function SubjectBars({ rows }: { rows: { id: string; name: string; color: string; minutes: number }[] }) {
  const lang = useI18n((s) => s.lang);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const total = rows.reduce((a, r) => a + r.minutes, 0) || 1;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm text-text-2">{r.name}</span>
          <span className="relative h-2.5 rounded-e-[4px]" aria-hidden>
            <span className="absolute inset-y-0 start-0 rounded-e-[4px]" style={{ width: `${(r.minutes / max) * 100}%`, background: r.color, minWidth: 2 }} />
          </span>
          <span className="text-sm text-text tabular">
            {formatDuration(r.minutes, lang)}
            <span className="ms-1.5 text-xs text-text-3">{Math.round((r.minutes / total) * 100)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5 text-xs text-text-2">
          <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}
