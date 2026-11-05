// Checks that Mizan can talk to your Supabase project: keys, tables, sign-in and Edge Functions.
// Usage: put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then `npm run check:supabase`.
import { existsSync, readFileSync } from 'node:fs';

const env = { ...process.env };
for (const f of ['.env', '.env.local']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }
}
const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = env.VITE_SUPABASE_ANON_KEY ?? '';
const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => {
  console.log(`  ✗ ${s}`);
  process.exitCode = 1;
};

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key) {
  bad('Set VITE_SUPABASE_URL (https://<ref>.supabase.co) and VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

console.log(`Checking ${url}`);
const auth = await fetch(`${url}/auth/v1/settings`, { headers }).catch(() => null);
if (auth?.ok) {
  const s = await auth.json();
  ok(`Auth reachable (email: ${s.external?.email ? 'on' : 'off'}, Google: ${s.external?.google ? 'on' : 'off'})`);
} else bad(`Auth not reachable (${auth?.status ?? 'network error'}): check the URL and anon key`);

const tables = ['profiles', 'settings', 'subjects', 'boards', 'columns', 'cards', 'checklist_items', 'attachments', 'focus_sessions', 'timer_state', 'chat_threads', 'chat_messages', 'flashcards', 'study_topics', 'books'];
const missing = [];
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, { headers }).catch(() => null);
  // Signed out, RLS answers 401/403 or an empty list: either way the table exists.
  if (!r || r.status === 404) missing.push(t);
  else {
    const body = r.ok ? null : await r.json().catch(() => null);
    if (body?.code === '42P01' || body?.code === 'PGRST205') missing.push(t);
  }
}
if (missing.length) bad(`Missing tables: ${missing.join(', ')}. Run supabase/setup.sql in the SQL Editor.`);
else ok(`All ${tables.length} tables exist`);

for (const fn of ['tutor', 'delete-account', 'send-reminders']) {
  const r = await fetch(`${url}/functions/v1/${fn}`, { method: 'OPTIONS' }).catch(() => null);
  if (r && r.status !== 404) ok(`Edge Function "${fn}" deployed`);
  else console.log(`  · Edge Function "${fn}" not deployed yet (optional until you use it)`);
}
console.log(process.exitCode ? '\nSome checks failed.' : '\nMizan is connected.');
