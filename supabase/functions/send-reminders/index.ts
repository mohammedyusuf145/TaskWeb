// Sends web-push reminders. Called every minute by pg_cron (see supabase/cron/schedule-reminders.sql).
// Auth: Authorization: Bearer <CRON_SECRET>. Never callable by app users.

import webpush from 'npm:web-push@3.6.7';
import { adminClient } from '../_shared/auth.ts';
import { buildMessage, type ReminderRow } from './messages.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const LOOKBACK_MIN = 10;

/** Constant-time comparison so the secret can't be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i]! ^ eb[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!CRON_SECRET || !safeEqual(token, CRON_SECRET)) return new Response('unauthorized', { status: 401 });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response('push_not_configured', { status: 503 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const db = adminClient();
  const now = new Date();
  const from = new Date(now.getTime() - LOOKBACK_MIN * 60_000);

  const { data, error } = await db.rpc('due_reminders', { p_from: from.toISOString(), p_to: now.toISOString() });
  if (error) {
    console.error('due_reminders failed', error.message);
    return new Response('query_failed', { status: 500 });
  }
  const rows = (data ?? []) as (ReminderRow & { user_id: string })[];
  let sent = 0;
  let removed = 0;

  for (const row of rows) {
    // Claim the reminder first; if another run already claimed it, skip (no duplicates).
    const { data: claimed, error: claimErr } = await db
      .from('reminder_log')
      .upsert({ card_id: row.card_id, offset_min: row.offset_min, due_at: row.due_at, user_id: row.user_id }, { onConflict: 'card_id,offset_min,due_at', ignoreDuplicates: true })
      .select('card_id');
    if (claimErr || !claimed?.length) continue;

    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', row.user_id);
    const payload = JSON.stringify(buildMessage(row));

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          TTL: 60 * 60,
          urgency: row.offset_min <= 60 ? 'high' : 'normal',
          topic: `c${row.card_id.replace(/-/g, '').slice(0, 30)}`,
        });
        sent++;
        await db.from('push_subscriptions').update({ last_used_at: now.toISOString() }).eq('id', sub.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          console.error('push failed', status ?? 'unknown');
        }
      }
    }
  }

  return new Response(JSON.stringify({ due: rows.length, sent, removed }), { headers: { 'Content-Type': 'application/json' } });
});
