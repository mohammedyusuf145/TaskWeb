import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAllCards, useBoards } from '@/lib/db/hooks';
import { useDbStore } from '@/lib/db';
import { getT, useI18n } from '@/lib/i18n';
import { hasPushSubscription, showLocalNotification } from '@/lib/push';
import { toast } from '@/components/ui';
import { useSettings } from '@/features/settings/settings';
import { remindersBetween } from './compute';
import { dueRelative } from './format';

const TICK_MS = 15_000;
const CATCH_UP_MS = 12 * 3600_000;

/**
 * In-app reminders: checks every 15s (and when the tab becomes visible) for reminders that came due,
 * adds them to the local inbox, shows a toast, and — when the server isn't pushing to this device —
 * a system notification if the page is in the background.
 */
export function ReminderScheduler() {
  const navigate = useNavigate();
  const { db, userId } = useDbStore();
  const cards = useAllCards();
  const boards = useBoards();
  const settings = useSettings();
  const state = useRef({ cards, boards, settings });
  state.current = { cards, boards, settings };

  // Notification clicks handled by the service worker ask the page to navigate.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        const url = new URL(e.data.url);
        if (url.origin === window.location.origin) navigate(url.pathname + url.search);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    if (!db || !userId) return;
    const key = `mizan.reminders.lastCheck.${userId}`;
    const read = () => {
      try {
        return Number(localStorage.getItem(key)) || 0;
      } catch {
        return 0;
      }
    };
    let running = false;

    const tick = async () => {
      const { cards: list, boards: active, settings: s } = state.current;
      if (running || !list || !active) return;
      running = true;
      try {
        const now = Date.now();
        const from = new Date(Math.max(read(), now - CATCH_UP_MS));
        const activeBoards = new Set(active.map((b) => b.id));
        const live = list.filter((c) => activeBoards.has(c.board_id));
        const due = remindersBetween(live, s.notifications.offsets_min, from, new Date(now));
        const t = getT();
        const lang = useI18n.getState().lang;

        for (const r of due) {
          if (await db.inbox.get(r.key)) continue;
          // A reminder for something already well past due is noise.
          if (r.dueAt.getTime() < now - 3600_000) continue;
          const card = live.find((c) => c.id === r.cardId)!;
          await db.inbox.put({
            key: r.key,
            card_id: card.id,
            board_id: card.board_id,
            title: card.title,
            offset_min: r.offsetMin,
            due_at: card.due_at!,
            fired_at: new Date(now).toISOString(),
            read: 0,
          });
          const when = dueRelative(r.dueAt, card.due_has_time, lang, new Date(now));
          const url = `/board/${card.board_id}?card=${card.id}`;
          if (s.notifications.in_app) {
            toast(`${card.is_exam ? `${t('board.exam')} · ` : ''}${card.title} — ${t('rem.dueIn', { when })}`, {
              duration: 10_000,
              action: { label: t('rem.openCard'), onClick: () => navigate(url) },
            });
          }
          if (s.notifications.push && !hasPushSubscription() && document.visibilityState === 'hidden') {
            void showLocalNotification(card.title, { body: t('rem.dueIn', { when }), tag: `card-${card.id}`, url, lang, dir: lang === 'ar' ? 'rtl' : 'ltr' });
          }
        }
        try {
          localStorage.setItem(key, String(now));
        } catch {
          /* ignore */
        }
        // Keep the inbox to two weeks.
        const cutoff = new Date(now - 14 * 86_400_000).toISOString();
        await db.inbox.where('fired_at').below(cutoff).delete();
      } finally {
        running = false;
      }
    };

    const id = setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === 'visible' && void tick();
    document.addEventListener('visibilitychange', onVisible);
    const first = setTimeout(tick, 1500);
    return () => {
      clearInterval(id);
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [db, userId, navigate]);

  return null;
}
