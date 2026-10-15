import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, BellRing } from 'lucide-react';
import { useAllCards, useBoards } from '@/lib/db/hooks';
import { useDbStore } from '@/lib/db';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { useSettings } from '@/features/settings/settings';
import { reminderTimes } from './compute';
import { dueRelative } from './format';

/** Bell with an unread count; lists recent reminders and what's coming up. */
export function ReminderCenter() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const navigate = useNavigate();
  const db = useDbStore((s) => s.db);
  const settings = useSettings();
  const cards = useAllCards();
  const boards = useBoards();
  const [open, setOpen] = useState(false);

  const inbox = useLiveQuery(async () => (db ? (await db.inbox.orderBy('fired_at').reverse().limit(30).toArray()) : []), [db]) ?? [];
  const unread = inbox.filter((i) => !i.read).length;

  // Recomputed each time the panel opens, so "coming up" never shows reminders that already fired.
  const upcoming = useMemo(() => {
    if (!open || !cards || !boards) return [];
    const active = new Set(boards.map((b) => b.id));
    const now = Date.now();
    return cards
      .filter((c) => active.has(c.board_id))
      .flatMap((c) => reminderTimes(c, settings.notifications.offsets_min).map((r) => ({ ...r, card: c })))
      .filter((r) => r.fireAt.getTime() > now)
      .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
      .slice(0, 5);
  }, [open, cards, boards, settings.notifications.offsets_min]);

  const go = (boardId: string, cardId: string) => {
    setOpen(false);
    navigate(`/board/${boardId}?card=${cardId}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && db && unread) void db.inbox.where('read').equals(0).modify({ read: 1 });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `${t('rem.open')} — ${t('rem.unread', { n: unread })}` : t('rem.open')}
          className="relative inline-flex size-10 items-center justify-center rounded-control text-text-2 hover:bg-surface-3 hover:text-text data-[state=open]:bg-surface-3"
        >
          {unread ? <BellRing size={18} /> : <Bell size={18} />}
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink tabular">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] !p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text">{t('rem.title')}</h2>
        </div>
        <div className="max-h-[min(70dvh,480px)] overflow-y-auto py-2">
          {inbox.length === 0 && upcoming.length === 0 && <p className="px-4 py-4 text-sm text-text-3">{t('rem.empty')}</p>}
          {inbox.length > 0 && (
            <section>
              <h3 className="px-4 pt-1 pb-1 text-xs font-medium text-text-3">{t('rem.recent')}</h3>
              <ul>
                {inbox.map((i) => (
                  <li key={i.key}>
                    <button type="button" onClick={() => go(i.board_id, i.card_id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-start hover:bg-surface-3">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', i.read ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-base text-text" dir="auto">
                          {i.title}
                        </span>
                        <span className="block text-xs text-text-3">{t('rem.dueIn', { when: dueRelative(new Date(i.due_at), true, lang) })}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {upcoming.length > 0 && (
            <section className={cn(inbox.length > 0 && 'mt-2 border-t border-border pt-2')}>
              <h3 className="px-4 pt-1 pb-1 text-xs font-medium text-text-3">{t('rem.upcoming')}</h3>
              <ul>
                {upcoming.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => go(r.card.board_id, r.card.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-start hover:bg-surface-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full border border-border-strong" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-base text-text-2" dir="auto">
                          {r.card.title}
                        </span>
                        <span className="block text-xs text-text-3">
                          {dueRelative(r.fireAt, true, lang)} · {t(`rem.offset.${r.offsetMin}` as 'rem.offset.0')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
