import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowDownRight, ArrowUpRight, ChartColumn, Flame, Timer } from 'lucide-react';
import { useAllCards, useFocusSessions, useSubjects } from '@/lib/db/hooks';
import { useI18n, useT, intlLocale } from '@/lib/i18n';
import { addDays, formatTime, relativeDay, startOfDay, startOfWeek } from '@/lib/dates';
import { chartColor, subjectColor } from '@/design/tokens';
import { cn } from '@/lib/cn';
import { Badge, Button, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';
import { useSettings } from '@/features/settings/settings';
import { useTimerPrefs } from '@/features/timer/prefs';
import { SUBJECT_COLORS } from '@/design/tokens';
import { bestWindow, dayKey, formatDuration, hourHistogram, minutesByDay, streaks, summarize } from '@/features/stats/aggregate';
import { HourColumns, Legend, StackedColumns, SubjectBars, type Series } from '@/features/stats/charts';

type Range = 'week' | 'month';

export function StatsPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const settings = useSettings();
  const prefs = useTimerPrefs();
  const subjects = useSubjects();
  const cards = useAllCards();
  const [range, setRange] = useState<Range>('week');
  const [tableView, setTableView] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);
  const since = useMemo(() => addDays(today, -400), [today]);
  const sessions = useFocusSessions(since);

  const from = range === 'week' ? startOfWeek(today, settings.week_start) : addDays(today, -27);
  const to = range === 'week' ? addDays(from, 7) : addDays(today, 1);
  const prevFrom = addDays(from, range === 'week' ? -7 : -28);

  const model = useMemo(() => {
    if (!sessions || !subjects) return null;
    const goal = prefs.dailyGoalMin;
    const cur = summarize(sessions, from, to, goal);
    const prev = summarize(sessions, prevFrom, from, goal);
    const inRange = sessions.filter((s) => new Date(s.started_at) >= from && new Date(s.started_at) < to);
    const byDay = minutesByDay(inRange);
    const subjById = new Map(subjects.map((s) => [s.id, s]));
    // Fixed palette order for stacking, so neighbours are always distinguishable.
    const slot = (hex: string) => {
      const i = SUBJECT_COLORS.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase());
      return i === -1 ? 99 : i;
    };
    const used = new Set(inRange.map((s) => s.subject_id ?? 'none'));
    const series: Series[] = [
      ...subjects.filter((s) => used.has(s.id)).sort((a, b) => slot(a.color) - slot(b.color)).map((s) => ({ id: s.id, name: s.name, color: chartColor(s.color) })),
      ...(used.has('none') || [...used].some((id) => id !== 'none' && !subjById.has(id)) ? [{ id: 'none', name: t('subject.none'), color: 'var(--text-3)' }] : []),
    ];
    const days = Array.from({ length: Math.round((to.getTime() - from.getTime()) / 86_400_000) }, (_, i) => addDays(from, i));
    const wd = new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'short' });
    const full = new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'long', day: 'numeric', month: 'short' });
    const data = days.map((d) => {
      const values: Record<string, number> = {};
      for (const [subj, m] of byDay.get(dayKey(d)) ?? []) {
        const key = subjById.has(subj) ? subj : 'none';
        values[key] = (values[key] ?? 0) + m;
      }
      return { key: dayKey(d), label: range === 'week' ? wd.format(d) : String(d.getDate()), title: full.format(d), values, emphasis: d.getTime() === today.getTime() };
    });
    const hist = hourHistogram(inRange.length ? inRange : sessions);
    const best = bestWindow(hist);
    const st = streaks(sessions, new Date());
    // The weekly summary always compares this week with last week, whatever range is shown.
    const weekStart = startOfWeek(today, settings.week_start);
    const week = summarize(sessions, weekStart, addDays(weekStart, 7), goal);
    const lastWeek = summarize(sessions, addDays(weekStart, -7), weekStart, goal);
    const daysElapsed = Math.max(1, Math.min(days.length, Math.round((today.getTime() - from.getTime()) / 86_400_000) + 1));
    return { cur, prev, series, data, hist, best, st, daysElapsed, inRange, subjById, week, lastWeek };
  }, [sessions, subjects, from.getTime(), to.getTime(), prevFrom.getTime(), prefs.dailyGoalMin, range, lang, today, t, settings.week_start]);

  if (sessions === undefined || subjects === undefined || !model)
    return (
      <>
        <PageHeader title={t('stats.title')} />
        <PageBody>
          <div className="grid gap-4 md:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
            <Skeleton className="h-64 md:col-span-4" />
          </div>
        </PageBody>
      </>
    );

  if (sessions.length === 0)
    return (
      <>
        <PageHeader title={t('stats.title')} />
        <PageBody>
          <EmptyState
            icon={<ChartColumn size={20} />}
            title={t('stats.empty.title')}
            body={t('stats.empty.body')}
            action={
              <Button variant="primary" iconStart={<Timer size={16} />} onClick={() => navigate('/focus')}>
                {t('stats.empty.cta')}
              </Button>
            }
          />
        </PageBody>
      </>
    );

  const { cur, prev, series, data, hist, best, st, daysElapsed, inRange, subjById, week, lastWeek } = model;
  const diff = cur.minutes - prev.minutes;
  const hourFmt = new Intl.DateTimeFormat(intlLocale(lang), { hour: 'numeric' });
  const hourLabel = (h: number) => hourFmt.format(new Date(2026, 0, 1, h));
  const highlight = new Set(best ? [best.start, (best.start + 1) % 24] : []);
  const subjectRows = cur.bySubject.map((r) => {
    const s = subjById.get(r.subjectId);
    return { id: r.subjectId, name: s?.name ?? t('subject.none'), color: s ? chartColor(s.color) : 'var(--text-3)', minutes: r.minutes };
  });
  const cardTitle = new Map((cards ?? []).map((c) => [c.id, c.title]));
  const recent = [...inRange].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 12);

  const weekDiff = week.minutes - lastWeek.minutes;
  const weekTop = week.bySubject[0] ? (subjById.get(week.bySubject[0].subjectId)?.name ?? t('subject.none')) : null;
  const summary = [
    lastWeek.minutes === 0
      ? t('stats.summary.first', { total: formatDuration(week.minutes, lang) })
      : Math.abs(weekDiff) < 1
        ? t('stats.summary.same', { total: formatDuration(week.minutes, lang) })
        : t(weekDiff > 0 ? 'stats.summary.more' : 'stats.summary.less', { total: formatDuration(week.minutes, lang), diff: formatDuration(Math.abs(weekDiff), lang) }),
    weekTop && week.minutes > 0 ? t('stats.summary.top', { subject: weekTop }) : '',
    best ? t('stats.bestWindow', { from: hourLabel(best.start), to: hourLabel((best.start + 2) % 24) }) : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <PageHeader title={t('stats.title')} />
      <PageBody>
        <div className="flex flex-col gap-6">
          <Segmented<Range>
            label={t('stats.title')}
            value={range}
            onValueChange={setRange}
            options={[
              { value: 'week', label: t('stats.range.week') },
              { value: 'month', label: t('stats.range.month') },
            ]}
            className="self-start"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t('stats.total')} className="sm:col-span-2 lg:col-span-1">
              <p className="text-4xl font-semibold tracking-tight text-text">{formatDuration(cur.minutes, lang)}</p>
              {prev.minutes > 0 && Math.abs(diff) >= 1 && (
                <p className={cn('mt-1 flex items-center gap-1 text-sm', diff > 0 ? 'text-success' : 'text-text-2')}>
                  {diff > 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
                  {diff > 0 ? '+' : '−'}
                  {formatDuration(Math.abs(diff), lang)}
                </p>
              )}
            </Tile>
            <Tile label={t('stats.sessions')}>
              <p className="text-2xl font-semibold text-text">{cur.sessions}</p>
              <p className="mt-1 text-sm text-text-3">{t('stats.goalDays', { n: cur.goalDays })}</p>
            </Tile>
            <Tile label={t('stats.streak')}>
              <p className="flex items-center gap-2 text-2xl font-semibold text-text">
                <Flame size={18} className={st.current ? 'text-warning' : 'text-text-3'} aria-hidden />
                {t('stats.days', { n: st.current })}
              </p>
              <p className="mt-1 text-sm text-text-3">{t('stats.bestStreak', { n: st.best })}</p>
            </Tile>
            <Tile label={t('stats.dailyAvg')}>
              <p className="text-2xl font-semibold text-text">{formatDuration(cur.minutes / daysElapsed, lang)}</p>
            </Tile>
          </div>

          <Card
            title={t('stats.perDay')}
            aside={
              <Segmented<'chart' | 'table'>
                label={t('stats.perDay')}
                value={tableView ? 'table' : 'chart'}
                onValueChange={(v) => setTableView(v === 'table')}
                options={[
                  { value: 'chart', label: t('stats.chartView') },
                  { value: 'table', label: t('stats.tableView') },
                ]}
              />
            }
          >
            {series.length > 1 && (
              <div className="mb-4">
                <Legend series={series} />
              </div>
            )}
            {tableView ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-start text-xs text-text-3">
                      <th className="py-2 pe-3 text-start font-medium" />
                      {series.map((s) => (
                        <th key={s.id} className="py-2 pe-3 text-end font-medium">
                          {s.name}
                        </th>
                      ))}
                      <th className="py-2 text-end font-medium">{t('stats.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((d) => {
                      const total = Object.values(d.values).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={d.key} className="border-b border-border">
                          <td className="py-2 pe-3 text-text-2">{d.title}</td>
                          {series.map((s) => (
                            <td key={s.id} className="py-2 pe-3 text-end text-text-2 tabular">
                              {d.values[s.id] ? formatDuration(d.values[s.id]!, lang) : '–'}
                            </td>
                          ))}
                          <td className="py-2 text-end font-medium text-text tabular">{total ? formatDuration(total, lang) : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <StackedColumns data={data} series={series} label={t('stats.perDay')} />
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t('stats.bySubject')}>
              {subjectRows.length ? <SubjectBars rows={subjectRows} /> : <p className="text-sm text-text-3">{t('stats.noneInRange')}</p>}
            </Card>
            <Card title={t('stats.bestTimes')}>
              <HourColumns hours={hist} highlight={highlight} color="var(--accent)" label={t('stats.bestTimes')} hourLabel={hourLabel} />
              {best && <p className="mt-3 text-sm text-text-2">{t('stats.bestWindow', { from: hourLabel(best.start), to: hourLabel((best.start + 2) % 24) })}</p>}
            </Card>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card title={t('stats.summary')}>
              <p className="text-base leading-relaxed text-text">{summary}</p>
            </Card>
            <Card title={t('stats.recent')}>
              {recent.length === 0 && <p className="text-sm text-text-3">{t('stats.noneInRange')}</p>}
              <ul className="-my-1 divide-y divide-border">
                {recent.map((s) => {
                  const subj = s.subject_id ? subjById.get(s.subject_id) : undefined;
                  const start = new Date(s.started_at);
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: subj ? subjectColor(subj.color) : 'var(--text-3)' }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text" dir="auto">
                          {(s.card_id && cardTitle.get(s.card_id)) || subj?.name || t('subject.none')}
                        </span>
                        <span className="block text-xs text-text-3">
                          {relativeDay(start, lang)} · {formatTime(start, lang)}
                          {s.card_id && subj ? ` · ${subj.name}` : ''}
                        </span>
                      </span>
                      {!s.completed && <Badge>{t('stats.partial')}</Badge>}
                      <span className="shrink-0 text-sm text-text tabular">{formatDuration(s.focused_sec / 60, lang)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Tile({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-card border border-border bg-surface-1 p-4 raised', className)}>
      <h2 className="mb-2 text-sm text-text-3">{label}</h2>
      {children}
    </section>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-card border border-border bg-surface-1 p-4 raised md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-text">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
