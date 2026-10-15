import { useMemo, useRef, type ReactNode } from 'react';
import { Flower2, Music } from 'lucide-react';
import { useAllCards, useBoards, useFocusSessions, useSubjects } from '@/lib/db/hooks';
import { useI18n, useT } from '@/lib/i18n';
import { startOfDay } from '@/lib/dates';
import { subjectColor } from '@/design/tokens';
import { cn } from '@/lib/cn';
import { Button, ProgressRing, Segmented, Select, Switch, toast } from '@/components/ui';
import { formatDuration, streaks } from '@/features/stats/aggregate';
import { PRESETS, type TimerConfig, type TimerState } from './engine';
import { configFor, updateTimerPrefs, useTimerPrefs, type TimerView } from './prefs';
import { timer } from './store';
import { sound, useSound, type Ambient } from './audio';
import { Sprout } from './Garden';

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-sm font-medium text-text-2">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

const sameLengths = (a: TimerConfig, b: TimerConfig) =>
  a.focusMin === b.focusMin && a.shortMin === b.shortMin && a.longMin === b.longMin && a.sessionsBeforeLong === b.sessionsBeforeLong;

function NumberField({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-text-2">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (n >= min && n <= max) onChange(n);
        }}
        className="h-9 w-20 rounded-control border border-border-strong bg-surface-2 px-2 text-center text-base text-text tabular focus:border-accent focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}

export function SessionPanel({ state }: { state: TimerState }) {
  const t = useT();
  const prefs = useTimerPrefs();
  const subjects = useSubjects() ?? [];
  const cards = useAllCards();
  const boards = useBoards();
  const idle = state.status === 'idle';
  const subject = subjects.find((s) => s.id === state.subjectId);
  const subjectHasConfig = Boolean(state.subjectId && prefs.perSubject[state.subjectId]);
  const preset = sameLengths(state.config, PRESETS.classic!) ? 'classic' : sameLengths(state.config, PRESETS.deep!) ? 'deep' : 'custom';
  const customOpen = useRef(preset === 'custom');
  if (preset === 'custom') customOpen.current = true;

  const openCards = useMemo(() => {
    const active = new Set((boards ?? []).map((b) => b.id));
    return (cards ?? [])
      .filter((c) => active.has(c.board_id) && !c.completed_at && (!state.subjectId || c.subject_id === state.subjectId || c.id === state.cardId))
      .sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'))
      .slice(0, 100);
  }, [cards, boards, state.subjectId, state.cardId]);

  /** Apply a config to the running timer and remember it (per subject when one has its own). */
  const applyConfig = async (config: TimerConfig) => {
    await timer.setConfig(config);
    if (state.subjectId && prefs.perSubject[state.subjectId]) await updateTimerPrefs({ perSubject: { ...prefs.perSubject, [state.subjectId]: config } });
    else await updateTimerPrefs({ config });
  };

  return (
    <Panel title={t('focus.session')}>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-3">{t('focus.subject')}</span>
        <Select
          value={state.subjectId ?? ''}
          onChange={async (e) => {
            const subjectId = e.target.value || null;
            const card = openCards.find((c) => c.id === state.cardId);
            await timer.link({ subjectId, cardId: card && card.subject_id !== subjectId ? null : state.cardId });
            if (idle) await timer.setConfig(configFor(prefs, subjectId));
          }}
        >
          <option value="">{t('subject.none')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-3">{t('focus.card')}</span>
        <Select
          value={state.cardId ?? ''}
          onChange={async (e) => {
            const card = openCards.find((c) => c.id === e.target.value);
            await timer.link({ cardId: card?.id ?? null, subjectId: card ? card.subject_id : state.subjectId });
            if (idle && card) await timer.setConfig(configFor(prefs, card.subject_id));
          }}
        >
          <option value="">{t('focus.noCard')}</option>
          {openCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </label>

      <Segmented<'pomodoro' | 'open'>
        label={t('focus.mode')}
        value={state.mode}
        onValueChange={(m) => idle && timer.setMode(m)}
        options={[
          { value: 'pomodoro', label: t('focus.mode.pomodoro') },
          { value: 'open', label: t('focus.mode.open') },
        ]}
        className="w-full"
      />

      {state.mode === 'pomodoro' && (
        <>
          <div role="radiogroup" aria-label={t('focus.preset')} className="flex gap-1.5">
            {(['classic', 'deep', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                onClick={() => {
                  if (p === 'custom') {
                    customOpen.current = true;
                    void applyConfig({ ...state.config, focusMin: state.config.focusMin === 25 || state.config.focusMin === 50 ? 40 : state.config.focusMin });
                  } else void applyConfig({ ...PRESETS[p]!, autoStartBreaks: state.config.autoStartBreaks, autoStartFocus: state.config.autoStartFocus });
                }}
                className={cn(
                  'h-9 flex-1 rounded-control border text-sm tabular transition-colors',
                  preset === p ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-2 hover:border-border-strong',
                )}
              >
                {t(`focus.preset.${p}`)}
              </button>
            ))}
          </div>
          {(preset === 'custom' || customOpen.current) && (
            <div className="flex flex-col gap-2 rounded-control border border-border bg-surface-1 p-3">
              <NumberField label={t('focus.focusLen')} value={state.config.focusMin} min={1} max={240} onChange={(v) => applyConfig({ ...state.config, focusMin: v })} />
              <NumberField label={t('focus.shortLen')} value={state.config.shortMin} min={1} max={60} onChange={(v) => applyConfig({ ...state.config, shortMin: v })} />
              <NumberField label={t('focus.longLen')} value={state.config.longMin} min={1} max={120} onChange={(v) => applyConfig({ ...state.config, longMin: v })} />
              <NumberField label={t('focus.rounds')} value={state.config.sessionsBeforeLong} min={1} max={12} onChange={(v) => applyConfig({ ...state.config, sessionsBeforeLong: v })} />
            </div>
          )}
          <Switch checked={state.config.autoStartBreaks} onCheckedChange={(v) => applyConfig({ ...state.config, autoStartBreaks: v })} label={t('focus.autoBreaks')} />
          <Switch checked={state.config.autoStartFocus} onCheckedChange={(v) => applyConfig({ ...state.config, autoStartFocus: v })} label={t('focus.autoFocus')} />
          {subject &&
            (subjectHasConfig ? (
              <p className="text-xs text-text-3">{t('focus.subjectDefault', { subject: subject.name })}</p>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={async () => {
                  await updateTimerPrefs({ perSubject: { ...prefs.perSubject, [subject.id]: state.config } });
                  toast(t('focus.savedSubject', { subject: subject.name }), { tone: 'success' });
                }}
              >
                {t('focus.saveSubject', { subject: subject.name })}
              </Button>
            ))}
        </>
      )}
    </Panel>
  );
}

const AMBIENTS: Ambient[] = ['none', 'rain', 'cafe', 'white', 'brown', 'track'];

export function LookPanel() {
  const t = useT();
  const prefs = useTimerPrefs();
  const { ambient, volume, trackName } = useSound();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Panel title={t('focus.view')}>
      <Segmented<TimerView>
        label={t('focus.view')}
        value={prefs.view}
        onValueChange={(view) => updateTimerPrefs({ view })}
        options={(['garden', 'clock', 'ring', 'ambient'] as TimerView[]).map((v) => ({ value: v, label: t(`focus.view.${v}`) }))}
        className="w-full"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-3">{t('focus.sound')}</span>
        <Select
          value={ambient}
          onChange={(e) => {
            const v = e.target.value as Ambient;
            if (v === 'track' && !trackName) return fileRef.current?.click();
            sound.setAmbient(v);
          }}
        >
          {AMBIENTS.map((a) => (
            <option key={a} value={a}>
              {a === 'track' && trackName ? `${t('focus.sound.track')} · ${trackName}` : t(`focus.sound.${a}`)}
            </option>
          ))}
        </Select>
      </label>
      {ambient === 'track' && (
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 self-start text-sm text-text-2 hover:text-text">
          <Music size={14} aria-hidden />
          {t('focus.sound.pickTrack')}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t('focus.sound.pickTrack')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.size <= 50 * 1024 * 1024) void sound.setTrack(f);
          e.target.value = '';
        }}
      />
      {ambient === 'track' && <p className="text-xs text-text-3">{t('focus.sound.trackHint')}</p>}
      <label className="flex items-center gap-3 text-sm text-text-2">
        <span className="w-24 shrink-0">{t('focus.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => sound.setVolume(Number(e.target.value))}
          aria-label={t('focus.volume')}
          className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
        />
      </label>
      <Switch checked={prefs.chime} onCheckedChange={(chime) => updateTimerPrefs({ chime })} label={t('focus.chime')} />
    </Panel>
  );
}

export function TodayPanel() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const prefs = useTimerPrefs();
  const subjects = useSubjects() ?? [];
  const since = useMemo(() => new Date(startOfDay(new Date()).getTime() - 400 * 86_400_000), []);
  const sessions = useFocusSessions(since) ?? [];
  const today = startOfDay(new Date());
  const todays = sessions.filter((s) => new Date(s.started_at) >= today);
  const minutes = todays.reduce((a, s) => a + s.focused_sec / 60, 0);
  const { current } = streaks(sessions, new Date());
  const colorOf = (id: string | null) => {
    const s = subjects.find((x) => x.id === id);
    return s ? subjectColor(s.color) : 'var(--accent)';
  };
  const completed = todays.filter((s) => s.completed).sort((a, b) => a.started_at.localeCompare(b.started_at));

  return (
    <Panel title={t('focus.today')}>
      <div className="flex items-center gap-4">
        <ProgressRing value={minutes / prefs.dailyGoalMin} size={64} stroke={5} label={t('focus.goalOf', { done: formatDuration(minutes, lang), goal: formatDuration(prefs.dailyGoalMin, lang) })}>
          <span className="text-xs font-medium text-text tabular">{Math.min(100, Math.round((minutes / prefs.dailyGoalMin) * 100))}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-base text-text">{t('focus.goalOf', { done: formatDuration(minutes, lang), goal: formatDuration(prefs.dailyGoalMin, lang) })}</p>
          <p className="text-sm text-text-3">{current > 0 ? t('focus.streak', { n: current }) : t('focus.noStreak')}</p>
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm text-text-2">
        <span>{t('focus.goalMinutes')}</span>
        <input
          type="number"
          min={10}
          max={720}
          step={10}
          value={prefs.dailyGoalMin}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (n >= 10 && n <= 720) void updateTimerPrefs({ dailyGoalMin: n });
          }}
          className="h-9 w-20 rounded-control border border-border-strong bg-surface-2 px-2 text-center text-base text-text tabular focus:border-accent focus:outline-none"
        />
      </label>
      <div>
        <p className="mb-2 text-xs text-text-3">{t('focus.garden.today')}</p>
        {completed.length ? (
          <div className="flex flex-wrap items-end gap-1.5" role="list" aria-label={t('focus.garden.today')}>
            {completed.slice(0, 16).map((s) => (
              <span key={s.id} role="listitem" title={formatDuration(s.focused_sec / 60, lang)}>
                <Sprout color={colorOf(s.subject_id)} />
              </span>
            ))}
            {completed.length > 16 && <span className="text-xs text-text-3">+{completed.length - 16}</span>}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-text-3">
            <Flower2 size={14} aria-hidden />
            {t('focus.garden.empty')}
          </p>
        )}
      </div>
    </Panel>
  );
}
