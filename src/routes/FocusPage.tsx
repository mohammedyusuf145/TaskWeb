import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useAllCards, useSubjects } from '@/lib/db/hooks';
import { getDb } from '@/lib/db';
import { useT } from '@/lib/i18n';
import { useHotkeys } from '@/lib/hotkeys';
import { subjectColor } from '@/design/tokens';
import { Button, IconButton, Skeleton } from '@/components/ui';
import { PageHeader } from '@/app/shell/PageHeader';
import { FocusStage, ambientBackground } from '@/features/timer/FocusStage';
import { progress } from '@/features/timer/engine';
import { LookPanel, SessionPanel, TodayPanel } from '@/features/timer/panels';
import { timer, useTimer } from '@/features/timer/store';
import { useTimerNow } from '@/features/timer/TimerRunner';
import { configFor, useTimerPrefs } from '@/features/timer/prefs';

export function FocusPage() {
  const t = useT();
  const { state, loaded } = useTimer();
  const now = useTimerNow();
  const prefs = useTimerPrefs();
  const subjects = useSubjects();
  const cards = useAllCards();
  const [params, setParams] = useSearchParams();
  const [full, setFull] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  const subject = subjects?.find((s) => s.id === state.subjectId);
  const color = subject ? subjectColor(subject.color) : 'var(--accent)';
  const linked = cards?.find((c) => c.id === state.cardId);

  // /focus?card=… (from a card's "Focus" button): link the card and its subject.
  const cardParam = params.get('card');
  useEffect(() => {
    if (!cardParam || !loaded) return;
    void (async () => {
      const card = await getDb().cards.get(cardParam);
      if (card && state.status === 'idle') {
        await timer.link({ cardId: card.id, subjectId: card.subject_id });
        await timer.setConfig(configFor(prefs, card.subject_id));
      }
      setParams((p) => (p.delete('card'), p), { replace: true });
    })();
  }, [cardParam, loaded]);

  useHotkeys({ ' ': () => void timer.toggle(), f: () => setFull(true) }, loaded);

  // Fullscreen focus mode: real fullscreen where supported, and Esc / exiting fullscreen closes it.
  useEffect(() => {
    if (!full) return;
    const el = overlay.current;
    if (el?.requestFullscreen && !document.fullscreenElement) void el.requestFullscreen().catch(() => {});
    const onChange = () => !document.fullscreenElement && setFull(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        void timer.toggle();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [full]);

  return (
    <>
      <PageHeader
        title={t('nav.timer')}
        actions={
          <Button size="sm" variant="ghost" iconStart={<Maximize2 size={15} />} onClick={() => setFull(true)} aria-keyshortcuts="f">
            <span className="max-sm:sr-only">{t('focus.fullscreen')}</span>
          </Button>
        }
      />
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-10">
        <section
          aria-label={t('nav.timer')}
          className="flex min-h-[520px] items-center justify-center overflow-hidden rounded-sheet border border-border bg-surface-1 px-4 py-10 transition-[background] duration-[2000ms] raised"
          style={prefs.view === 'ambient' ? { backgroundImage: ambientBackground(color, progress(state, now), state.status === 'running') } : undefined}
        >
          {loaded ? (
            <FocusStage state={state} now={now} view={prefs.view} color={color} linkedTitle={linked?.title} />
          ) : (
            <div className="flex flex-col items-center gap-4" aria-busy="true">
              <Skeleton className="size-56 rounded-full" />
              <Skeleton className="h-12 w-44 rounded-full" />
            </div>
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <SessionPanel state={state} />
          <LookPanel />
          <TodayPanel />
        </aside>
      </div>

      {full && (
        <div ref={overlay} role="dialog" aria-modal="true" aria-label={t('focus.fullscreen')} className="anim-overlay fixed inset-0 z-[var(--z-palette)] flex items-center justify-center overflow-hidden bg-bg"
          data-state="open"
          style={prefs.view === 'ambient' ? { backgroundImage: ambientBackground(color, progress(state, now), state.status === 'running') } : undefined}
        >
          <IconButton label={t('focus.exitFullscreen')} icon={<Minimize2 size={18} />} onClick={() => setFull(false)} className="absolute end-4 top-4" />
          <FocusStage state={state} now={now} view={prefs.view} color={color} linkedTitle={linked?.title} large />
        </div>
      )}
    </>
  );
}
