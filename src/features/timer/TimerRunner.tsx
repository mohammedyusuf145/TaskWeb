import { useEffect, useReducer, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDbStore } from '@/lib/db';
import { getT, useI18n } from '@/lib/i18n';
import { showLocalNotification } from '@/lib/push';
import { startOfDay } from '@/lib/dates';
import { toast } from '@/components/ui';
import { streaks, STREAK_MIN_MINUTES } from '@/features/stats/aggregate';
import { useTimerPrefs } from './prefs';
import { applyRemote, markLoaded, onPhaseEnd, timer, useTimer } from './store';
import { formatClock, initialState, remainingMs, elapsedMs, type TimerState } from './engine';
import { sound } from './audio';

const STREAK_MOMENTS = new Set([3, 7, 14, 30, 50, 100]);
const DEFAULT_TITLE = document.title;

/**
 * Keeps the timer correct everywhere in the app: loads/syncs state, completes phases on time
 * (even after the tab slept), logs sessions, plays the chime and marks gentle milestones.
 */
export function TimerRunner() {
  const { db, userId } = useDbStore();
  const prefs = useTimerPrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const row = useLiveQuery(async () => (db && userId ? ((await db.timer_state.get(userId)) ?? null) : undefined), [db, userId]);

  // Load / receive state from storage or other devices.
  useEffect(() => {
    if (row === undefined) return;
    if (row === null || !row.state || (row.state as Partial<TimerState>).v !== 1) {
      useTimer.setState({ state: initialState(prefsRef.current.config) });
      markLoaded();
      return;
    }
    applyRemote(row.state as unknown as TimerState, row.updated_at);
  }, [row]);

  // Tick: complete phases on time and keep the tab title useful.
  useEffect(() => {
    const id = setInterval(() => {
      void timer.tick();
      const s = useTimer.getState().state;
      if (s.status === 'running') {
        const t = getT();
        const rem = remainingMs(s, Date.now());
        const clock = formatClock(rem ?? elapsedMs(s, Date.now()));
        document.title = `${clock} · ${s.mode === 'open' ? t('focus.phase.open') : t(`focus.phase.${s.phase}`)}`;
      } else if (document.title !== DEFAULT_TITLE) document.title = DEFAULT_TITLE;
    }, 500);
    return () => {
      clearInterval(id);
      document.title = DEFAULT_TITLE;
    };
  }, []);

  // Time away during focus (for the garden's gentle lean).
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else {
        if (hiddenAt !== null) timer.visibility(hiddenAt, Date.now());
        hiddenAt = null;
        void timer.tick();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Phase ends: chime, notification, milestones.
  useEffect(
    () =>
      onPhaseEnd(async (logs, ended) => {
        const t = getT();
        const lang = useI18n.getState().lang;
        const focusEnded = ended.includes('focus');
        if (prefsRef.current.chime) {
          try {
            sound.chime();
          } catch {
            /* audio not unlocked yet */
          }
        }
        const message = focusEnded ? t('focus.done.focus') : t('focus.done.break');
        if (document.visibilityState === 'hidden') void showLocalNotification('Mizan', { body: message, tag: 'mizan-timer', url: '/focus', lang });
        else toast(message, { tone: 'success' });

        if (!logs.length || !db) return;
        const today = startOfDay(new Date());
        const sessions = (await db.focus_sessions.where('started_at').aboveOrEqual(new Date(today.getTime() - 400 * 86_400_000).toISOString()).toArray()).filter((s) => !s.deleted_at);
        const todayMin = sessions.filter((s) => new Date(s.started_at) >= today).reduce((a, s) => a + s.focused_sec / 60, 0);
        const added = logs.reduce((a, l) => a + l.focusedSec / 60, 0);
        const before = todayMin - added;
        const goal = prefsRef.current.dailyGoalMin;
        if (before < goal && todayMin >= goal) toast(t('focus.milestone.goal'), { tone: 'success', duration: 6000 });
        else if (before < STREAK_MIN_MINUTES && todayMin >= STREAK_MIN_MINUTES) {
          const { current } = streaks(sessions, new Date());
          if (STREAK_MOMENTS.has(current)) toast(t('focus.milestone.streak', { n: current }), { tone: 'success', duration: 6000 });
        }
      }),
    [db],
  );

  return null;
}

/** Re-render on an interval while the timer runs (for live clocks). */
export function useTimerNow(intervalMs = 250): number {
  const running = useTimer((s) => s.state.status === 'running');
  const [, force] = useReducerTick();
  useEffect(() => {
    if (!running) return;
    const id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [running, intervalMs, force]);
  return Date.now();
}

function useReducerTick() {
  return useReducer((x: number) => x + 1, 0);
}
